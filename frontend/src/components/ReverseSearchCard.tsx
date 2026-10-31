import { useState } from "react";
import { ReverseSearchResponse } from "../types/models";

interface ReverseSearchCardProps {
  caseId: string;
  evidenceId: string;
  onTriggerSearch: (confirmedConsent: boolean) => Promise<void>;
  isSearching: boolean;
  searchResult?: ReverseSearchResponse | null;
}

export const ReverseSearchCard: React.FC<ReverseSearchCardProps> = ({
  caseId,
  evidenceId,
  onTriggerSearch,
  isSearching,
  searchResult,
}) => {
  const [explicitConsent, setExplicitConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleStartSearch = async () => {
    if (!explicitConsent) {
      setShowModal(true);
      return;
    }
    await onTriggerSearch(true);
  };

  const handleModalConfirm = async () => {
    setExplicitConsent(true);
    setShowModal(false);
    await onTriggerSearch(true);
  };

  return (
    <div className="app-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", color: "#059669" }}>
            🌐
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em" }}>
              5. Distribution & Reverse Image Search
            </h2>
            <p style={{ fontSize: "0.825rem", color: "var(--color-text-muted)" }}>
              Public web index discovery via SerpApi Google Lens protocol
            </p>
          </div>
        </div>
        <span className="badge-clean badge-emerald">
          <span className="status-dot-emerald" /> External Lens Protocol
        </span>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
        Search for online distribution across public indices using Google Lens via SerpApi.
        Evidence ID: <code style={{ color: "#065f46", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{evidenceId.slice(0, 8)}...</code> (Case: <code style={{ color: "#065f46", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{caseId.slice(0, 8)}...</code>)
      </p>

      {/* Strict Consent & Provider Disclosure Banner */}
      <div
        style={{
          backgroundColor: "#f0fdf4",
          border: "1.5px solid #a7f3d0",
          borderRadius: "12px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <span style={{ fontSize: "1.2rem" }}>⚠️</span>
          <h4 style={{ color: "#065f46", fontSize: "0.95rem", fontWeight: 700 }}>
            External Provider Transfer Disclosure
          </h4>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#166534", lineHeight: 1.55, marginBottom: "1rem" }}>
          Triggering this query transmits the selected evidence image to <strong>Google Lens (via SerpApi)</strong>.
          Social media platforms are not scraped and access controls are not bypassed.
          To maintain strict privacy, you must explicitly opt in.
        </p>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.85rem", color: "#064e3b", cursor: "pointer", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={explicitConsent}
            onChange={(e) => setExplicitConsent(e.target.checked)}
            style={{ marginTop: "0.2rem", accentColor: "#059669", width: "17px", height: "17px", cursor: "pointer" }}
          />
          <span>
            <strong>Explicit Authorization:</strong> I explicitly consent to sending this evidence item to Google Lens / SerpApi for distribution mapping. I acknowledge that visually similar search results do not prove shared source or intentional redistribution.
          </span>
        </label>
      </div>

      {!searchResult && (
        <button
          type="button"
          onClick={handleStartSearch}
          disabled={isSearching}
          className="btn-emerald"
          style={{ width: "100%", padding: "0.85rem 1.5rem" }}
        >
          {isSearching ? "Querying Google Lens API..." : "Authorize & Initiate External Reverse Search"}
        </button>
      )}

      {/* Search Results Display */}
      {searchResult && (
        <div style={{ marginTop: "1rem" }} className="animate-fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text)" }}>
              Provider: {searchResult.provider} ({searchResult.search_duration_ms?.toFixed(0)} ms)
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
              Exact Matches: <strong style={{ color: "#059669" }}>{searchResult.exact_matches_count}</strong> | Visual Matches: <strong style={{ color: "#d97706" }}>{searchResult.visual_matches_count}</strong>
            </span>
          </div>

          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              padding: "0.9rem 1.15rem",
              borderRadius: "10px",
              fontSize: "0.8rem",
              color: "var(--color-text-secondary)",
              marginBottom: "1.25rem",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--color-text)" }}>Legal Notice:</strong> {searchResult.disclaimer}
          </div>

          {searchResult.exact_matches.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ color: "#065f46", fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.6rem" }}>
                Identical / Exact Hash Matches (SHA-256 / pHash)
              </h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {searchResult.exact_matches.map((m, idx) => (
                  <li
                    key={idx}
                    style={{
                      backgroundColor: "#ffffff",
                      padding: "0.85rem 1.15rem",
                      borderRadius: "10px",
                      border: "1.5px solid #a7f3d0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.85rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ color: "#059669", fontWeight: 600, wordBreak: "break-all", textDecoration: "underline" }}>
                      {m.title || m.link}
                    </a>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: "1rem", whiteSpace: "nowrap" }}>
                      {m.source}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {searchResult.visual_matches.length > 0 ? (
            <div>
              <h4 style={{ color: "#b45309", fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.6rem" }}>
                Visually Similar Matches (Unverified Origin)
              </h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {searchResult.visual_matches.map((m, idx) => (
                  <li
                    key={idx}
                    style={{
                      backgroundColor: "#ffffff",
                      padding: "0.85rem 1.15rem",
                      borderRadius: "10px",
                      border: "1.5px solid #fde68a",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.85rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ color: "#0284c7", wordBreak: "break-all" }}>
                      {m.title || m.link}
                    </a>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: "1rem", whiteSpace: "nowrap" }}>
                      {m.source}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>No visual matches returned by provider.</p>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="app-card"
            style={{
              padding: "2rem",
              maxWidth: "520px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              marginBottom: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.3rem" }}>🚨</span>
              <h3 style={{ color: "#b91c1c", fontSize: "1.2rem", fontWeight: 700 }}>
                Confirm External Data Transfer
              </h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1.5rem", lineHeight: 1.55 }}>
              You are about to transfer image evidence to Google Lens servers via SerpApi.
              This search query cannot be recalled once sent. Do you wish to continue?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.85rem" }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-emerald btn-secondary"
                style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                className="btn-danger"
                style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem" }}
              >
                I Affirm & Authorize Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
