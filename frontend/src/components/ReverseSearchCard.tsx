import { useState } from "react";
import { AlertTriangle, Globe2 } from "lucide-react";
import { ReverseSearchResponse } from "../types/models";
import { ConfirmDialog } from "./ui/ConfirmDialog";

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
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--accent-surface)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
            <Globe2 size={20} aria-hidden="true" />
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
          <span className="status-dot-emerald" /> Optional public web search
        </span>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
        Search for online distribution across public indices using Google Lens via SerpApi.
        Evidence ID: <code style={{ color: "var(--accent-primary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{evidenceId.slice(0, 8)}...</code> (Case: <code style={{ color: "var(--accent-primary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{caseId.slice(0, 8)}...</code>)
      </p>

      {/* Strict Consent & Provider Disclosure Banner */}
      <div
        style={{
          backgroundColor: "var(--status-review-bg)",
          border: "1px solid var(--status-review-border)",
          borderRadius: "12px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <AlertTriangle size={18} aria-hidden="true" />
          <h4 style={{ color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 600 }}>
            External Provider Transfer Disclosure
          </h4>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "1rem" }}>
          Triggering this query transmits the selected evidence image to <strong>Google Lens (via SerpApi)</strong>.
          Social media platforms are not scraped and access controls are not bypassed.
          To maintain strict privacy, you must explicitly opt in.
        </p>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer", lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={explicitConsent}
            onChange={(e) => setExplicitConsent(e.target.checked)}
            style={{ marginTop: "0.2rem", accentColor: "var(--accent-primary)", width: "17px", height: "17px", cursor: "pointer" }}
          />
          <span>
            <strong>One-time permission:</strong> I agree to send this evidence item to Google Lens through SerpApi for a public web search. Similar results do not establish who shared an image or why.
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
          {isSearching ? "Searching the public web…" : "Search public websites"}
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
              Exact matches: <strong style={{ color: "var(--status-ready)" }}>{searchResult.exact_matches_count}</strong> | Visual matches: <strong style={{ color: "var(--status-review)" }}>{searchResult.visual_matches_count}</strong>
            </span>
          </div>

          <div
            style={{
              backgroundColor: "var(--surface-secondary)",
              border: "1px solid var(--border-light)",
              padding: "0.9rem 1.15rem",
              borderRadius: "10px",
              fontSize: "0.8rem",
              color: "var(--color-text-secondary)",
              marginBottom: "1.25rem",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--color-text)" }}>Legal notice:</strong> {searchResult.disclaimer}
          </div>

          {searchResult.exact_matches.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ color: "var(--status-ready)", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.6rem" }}>
                Identical or exact hash matches (SHA-256 / pHash)
              </h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {searchResult.exact_matches.map((m, idx) => (
                  <li
                    key={idx}
                    style={{
                      backgroundColor: "var(--surface-primary)",
                      padding: "0.85rem 1.15rem",
                      borderRadius: "10px",
                      border: "1px solid var(--status-ready-border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.85rem",
                      boxShadow: "var(--shadow-xs)",
                    }}
                  >
                    <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)", fontWeight: 500, wordBreak: "break-all", textDecoration: "underline" }}>
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
              <h4 style={{ color: "var(--status-review)", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.6rem" }}>
                Visually similar matches (unverified origin)
              </h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {searchResult.visual_matches.map((m, idx) => (
                  <li
                    key={idx}
                    style={{
                      backgroundColor: "var(--surface-primary)",
                      padding: "0.85rem 1.15rem",
                      borderRadius: "10px",
                      border: "1px solid var(--status-review-border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.85rem",
                      boxShadow: "var(--shadow-xs)",
                    }}
                  >
                    <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)", wordBreak: "break-all" }}>
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

      <ConfirmDialog
        open={showModal}
        title="Send this image for a public web search?"
        description="The selected image will be sent to Google Lens through SerpApi. This is optional. Search results may be incomplete and do not prove who shared an image or why."
        confirmLabel="Authorize one-time search"
        onCancel={() => setShowModal(false)}
        onConfirm={handleModalConfirm}
      />
    </div>
  );
};
