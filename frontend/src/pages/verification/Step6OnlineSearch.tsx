import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { runReverseSearch } from "../../services/api";
import {
  Globe,
  Search,
  Lock,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

export default function Step6OnlineSearch() {
  const navigate = useNavigate();
  const {
    consent,
    setConsent,
    activeCase,
    reverseSearchResult,
    setReverseSearchResult,
  } = useVerification();

  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteSearch = async () => {
    if (!activeCase) {
      setError(
        "Please ensure an image check request is active before running the search."
      );
      return;
    }
    const evidenceId = activeCase.evidence_items?.[0]?.id || "ev-provisional";
    setSearching(true);
    setError(null);
    try {
      const res = await runReverseSearch(activeCase.id, evidenceId, true);
      setReverseSearchResult(res);
      setConsent((prev) => ({ ...prev, allowReverseSearch: true }));
    } catch {
      setError(
        "Could not complete the online search query at this time. The external service may be unreachable."
      );
    } finally {
      setSearching(false);
    }
  };

  const matches: Array<Record<string, any>> =
    reverseSearchResult?.matches ||
    reverseSearchResult?.exact_matches ||
    reverseSearchResult?.visual_matches ||
    [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs space-y-6"
    >
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
          6. Optional Online Web Search
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed font-sans">
          Check whether this image has been published or indexed on public
          websites. This step is completely optional and opt-in.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-accent-goldSoft border border-accent-gold/40 text-ink text-xs">
          <span>{error}</span>
        </div>
      )}

      {/* Explicit Consent Guard */}
      {!consent.allowReverseSearch && !reverseSearchResult ? (
        <div className="p-6 sm:p-7 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 shadow-2xs">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5 border border-brand-border">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-bold text-ink font-heading">
                External Search is Off by Default
              </h4>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed mb-5 max-w-xl">
                To preserve your complete privacy, ShieldHer does not send your
                image to outside search engines unless you explicitly ask to
                check. If you suspect this image has already been circulated, you
                can authorize a one-time lookup across indexed public pages.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50"
                onClick={handleExecuteSearch}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>
                  {searching
                    ? "Searching public web…"
                    : "Authorize & Search Public Web"}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-brand-sage/20 border border-brand-border flex items-center justify-between gap-3 text-xs text-ink-secondary">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-forest flex-shrink-0" />
              <span>
                <strong className="text-ink font-semibold">External Search Executed:</strong> A query was submitted
                to check for matching public index entries.
              </span>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-pearl border border-ink-border text-ink text-xs font-semibold hover:bg-canvas-subtle transition-colors shadow-2xs flex-shrink-0"
              onClick={handleExecuteSearch}
              disabled={searching}
            >
              <RotateCcw className="w-3 h-3 text-ink-muted" />
              <span>{searching ? "Searching…" : "Search again"}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <h4 className="text-sm font-bold text-ink font-heading">
              Public Matches Found ({matches.length})
            </h4>
          </div>

          {matches.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#FAF8F5] border border-ink-border/80">
              <CheckCircle2 className="w-8 h-8 text-brand-rich mx-auto mb-2" />
              <h5 className="text-sm font-bold text-ink font-heading">
                No public matches found
              </h5>
              <p className="text-xs text-ink-secondary mt-1">
                We did not find instances of this image on indexed public
                websites.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-ink-border/80 bg-surface-pearl shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] border-b border-ink-border text-ink-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">Platform / Source</th>
                    <th className="py-3 px-4 sm:px-6">Date Detected</th>
                    <th className="py-3 px-4 sm:px-6">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-border/50">
                  {matches.map((m, idx) => (
                    <tr key={idx} className="hover:bg-canvas-subtle/50 transition-colors">
                      <td className="py-3 px-4 sm:px-6 font-semibold text-ink">
                        {m.domain || m.source || "Web Listing"}
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-ink-secondary whitespace-nowrap">
                        {m.crawl_date
                          ? new Date(m.crawl_date).toLocaleDateString()
                          : "Recent"}
                      </td>
                      <td className="py-3 px-4 sm:px-6">
                        <a
                          href={m.url || m.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-forest hover:text-brand-rich hover:underline break-all font-medium"
                        >
                          <span className="truncate max-w-xs">
                            {m.url || m.link || "View listing"}
                          </span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Navigation Action Buttons */}
      <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          onClick={() => navigate("/verification/forensics")}
          disabled={searching}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Findings</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow"
          onClick={() => navigate("/verification/incident-details")}
        >
          <span>Continue to Incident Information</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
