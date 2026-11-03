import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCases } from "../services/api";
import { CaseItem } from "../types/models";

export default function ReportsPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await listCases();
        if (isMounted) setCases(data || []);
      } catch (_) {}
      finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.45rem", fontWeight: 700, marginBottom: "4px" }}>
            Forensic Reports & Legal Drafts
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Access generated complaints, evidence certificates, and cybercrime reporting documentation.
          </p>
        </div>

        <Link to="/verification/consent" className="btn btn-primary">
          <span>+</span> Generate New Report
        </Link>
      </div>

      {/* Guidance Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="metric-tile-clean">
          <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>
            🏛️ Indian Cybercrime Portal Format
          </strong>
          <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.45 }}>
            Complaints are drafted to align with Section 66E, 67, and 67A of the IT Act 2000, 
            ready for submission at cybercrime.gov.in.
          </p>
        </div>

        <div className="metric-tile-clean">
          <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>
            📋 ISO/IEC 27037 Evidence Summary
          </strong>
          <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.45 }}>
            Exportable chain-of-custody logs with cryptographic SHA-256 hashes establishing evidence authenticity in judicial proceedings.
          </p>
        </div>

        <div className="metric-tile-clean">
          <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>
            🛡️ Mistral AI Synthesis Engine
          </strong>
          <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.45 }}>
            Advanced automated legal drafting that correlates forensic model scores with user incident narratives.
          </p>
        </div>
      </div>

      {/* Case Dockets with Reports */}
      <div className="panel">
        <h2 className="panel-title" style={{ marginBottom: "16px" }}>
          Registered Case Reports
        </h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            Loading case report packages…
          </div>
        ) : cases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <h3 className="empty-state-title">No Case Reports Found</h3>
            <p className="empty-state-desc">
              Complete a verification workflow to generate your first forensic report and legal complaint draft.
            </p>
            <Link to="/verification/consent" className="btn btn-primary">
              Start Verification Flow
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case Number</th>
                  <th>Docket Title</th>
                  <th>Adjudication</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Report Package</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="code-pill">{c.case_number}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.title}</td>
                    <td>
                      <span className="badge badge-teal">
                        {c.review_status || "UNREVIEWED"}
                      </span>
                    </td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={`/cases/${c.id}`} className="btn btn-outline btn-sm">
                        View Report & Draft →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
