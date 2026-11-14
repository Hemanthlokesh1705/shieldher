import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Archive } from "lucide-react";
import { listCases } from "../services/api";
import { EvidenceItem } from "../types/models";

interface FlatEvidenceItem extends EvidenceItem {
  case_number?: string;
  case_title?: string;
}

export default function EvidencePage() {
  const [evidenceList, setEvidenceList] = useState<FlatEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadEvidence() {
      setLoading(true);
      setError(null);
      try {
        const cases = await listCases();
        const allEv: FlatEvidenceItem[] = [];
        for (const c of cases || []) {
          if (c.evidence_items && c.evidence_items.length > 0) {
            for (const item of c.evidence_items) {
              allEv.push({
                ...item,
                case_number: c.case_number,
                case_title: c.title,
              });
            }
          }
        }
        if (isMounted) setEvidenceList(allEv);
      } catch (err: any) {
        if (isMounted) setError(err?.message || "Failed to load evidence library.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEvidence();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-2xl border border-ink-border bg-surface-pearl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-2xl font-medium text-ink">Evidence</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
              Files saved with your image checks, along with their request
              references and verification details.
            </p>
          </div>
          <Link
            to="/verification/consent"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Add an image
          </Link>
        </div>
      </header>

      {error && (
        <div
          className="flex items-start gap-3 rounded-xl border border-status-errorBorder bg-status-errorBg p-4 text-sm text-status-error"
          role="alert"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div
          className="rounded-2xl border border-ink-border bg-surface-pearl py-16 text-center text-sm text-ink-muted"
          aria-live="polite"
        >
          Loading your evidence…
        </div>
      ) : evidenceList.length === 0 ? (
        <section className="rounded-2xl border border-ink-border bg-surface-pearl px-6 py-12 text-center">
          <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-sage text-brand-forest">
            <Archive size={20} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-medium text-ink">No saved evidence yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
            Evidence associated with an image check will appear here for you to review.
          </p>
          <Link
            to="/verification/consent"
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Start an image check
          </Link>
        </section>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-border bg-surface-pearl">
          <div className="overflow-x-auto">
            <table className="data-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>File name</th>
                <th>Format</th>
                <th>File size</th>
                <th>SHA-256</th>
                <th>Storage</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {evidenceList.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <span className="code-pill">{ev.case_number || "Request"}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ev.filename_sanitized}</td>
                  <td>{ev.mime_type || "image/jpeg"}</td>
                  <td>{(ev.file_size_bytes / 1024).toFixed(1)} KB</td>
                  <td>
                    <span className="code-pill" title={ev.original_sha256}>
                      {ev.original_sha256?.substring(0, 16) || "Not available"}…
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${ev.is_preserved ? "badge-green" : "badge-gray"}`}>
                      {ev.is_preserved ? "Saved" : "Temporary"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/cases/${ev.case_id}`} className="btn btn-outline btn-sm">
                      View request
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
