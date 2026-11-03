import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
    <div>
      <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.45rem", fontWeight: 700, marginBottom: "4px" }}>
            Evidence Vault & Cryptographic Library
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Tamper-evident forensic repository conforming to ISO/IEC 27037 chain-of-custody standards.
          </p>
        </div>

        <Link to="/verification/consent" className="btn btn-primary">
          <span>+</span> Ingest New Evidence
        </Link>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
          Loading sealed evidence records…
        </div>
      ) : evidenceList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <h3 className="empty-state-title">No Sealed Evidence Items</h3>
          <p className="empty-state-desc">
            Evidence items ingested during forensic verifications will appear here with permanent SHA-256 digests.
          </p>
          <Link to="/verification/consent" className="btn btn-primary">
            Start Verification Intake
          </Link>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case Reference</th>
                <th>Sanitized Filename</th>
                <th>Format</th>
                <th>File Size</th>
                <th>SHA-256 Digest</th>
                <th>Preservation Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {evidenceList.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <span className="code-pill">{ev.case_number || "SH-DOCKET"}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ev.filename_sanitized}</td>
                  <td>{ev.mime_type || "image/jpeg"}</td>
                  <td>{(ev.file_size_bytes / 1024).toFixed(1)} KB</td>
                  <td>
                    <span className="code-pill" title={ev.original_sha256}>
                      {ev.original_sha256?.substring(0, 16)}…
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${ev.is_preserved ? "badge-green" : "badge-gray"}`}>
                      {ev.is_preserved ? "SEALED" : "EXPLORATORY"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/cases/${ev.case_id}`} className="btn btn-outline btn-sm">
                      Inspect Docket
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
