import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { listCases } from "../services/api";
import { CaseItem } from "../types/models";
import {
  PlusCircle,
  Search,
  ArrowRight,
  Shield,
  RotateCcw,
  Loader2,
  FileCheck,
} from "lucide-react";

export default function CasesPage() {
  const [requests, setRequests] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCases();
      setRequests(data || []);
    } catch {
      setError(
        "Unable to load your requests. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = requests.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchesRef =
      r.case_number && r.case_number.toLowerCase().includes(term);
    const matchesTitle = r.title && r.title.toLowerCase().includes(term);
    return matchesRef || matchesTitle;
  });

  const getStatusBadge = (item: CaseItem) => {
    if (item.status === "CLOSED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-canvas-sand text-ink-secondary">
          Closed
        </span>
      );
    }
    if (
      item.review_status === "CONFIRMED_MANIPULATION" ||
      item.review_status === "AUTHENTIC"
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-sage/50 text-brand-forest border border-brand-border">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-rich" />
          Report ready
        </span>
      );
    }
    if (item.review_status === "UNDER_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-goldSoft text-accent-gold border border-accent-gold/30">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
          Review available
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-canvas-subtle text-ink-secondary border border-ink-border">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-muted" />
        In progress
      </span>
    );
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      return new Date(isoString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-10"
    >
      {/* Header Panel */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
            My Requests
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary mt-1 font-sans">
            Review previous image checks, digital evidence receipts, and
            generated complaint drafts.
          </p>
        </div>

        <Link
          to="/verification/consent"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Check an Image</span>
        </Link>
      </div>

      {/* Search Filter Bar */}
      {requests.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full h-11 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
            placeholder="Search by reference code or label…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {error ? (
        <div className="p-4 rounded-xl bg-accent-goldSoft border border-accent-gold/40 text-ink text-xs flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-pearl border border-accent-gold/50 text-ink font-semibold hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={loadRequests}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      ) : loading ? (
        <div className="p-16 text-center text-xs text-ink-muted">
          <Loader2 className="w-6 h-6 animate-spin text-brand-forest mx-auto mb-2.5" />
          <span>Loading your requests…</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface-pearl border border-ink-border/80 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Shield className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-ink font-heading">Nothing here yet</h4>
          <p className="text-xs text-ink-secondary mt-1.5 max-w-sm mx-auto leading-relaxed mb-5">
            {searchTerm
              ? "No requests matched your search query."
              : "When you check an image, your request docket will appear here so you can review findings or prepare an official report."}
          </p>
          <Link
            to="/verification/consent"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-forest text-surface-pearl text-xs font-semibold hover:bg-brand-rich transition-all shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Check an image</span>
          </Link>
        </div>
      ) : (
        <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F6] border-b border-ink-border text-ink-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Reference</th>
                  <th className="py-3 px-4 sm:px-6">Request Title</th>
                  <th className="py-3 px-4 sm:px-6">Status</th>
                  <th className="py-3 px-4 sm:px-6">Date Created</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border/50">
                {filteredRequests.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-canvas-subtle/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-ink">
                      <span className="px-2 py-0.5 rounded bg-canvas-sand text-ink text-[11px] font-medium">
                        {r.case_number || r.id.substring(0, 8)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-3.5 h-3.5 text-brand-forest flex-shrink-0" />
                        <span className="truncate max-w-xs font-semibold">
                          {r.title || "Private Image Assessment"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">{getStatusBadge(r)}</td>
                    <td className="py-3.5 px-4 sm:px-6 text-ink-secondary whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <Link
                        to={`/cases/${r.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-ink-border bg-surface-pearl text-ink text-xs font-semibold hover:border-brand-rich hover:text-brand-forest transition-colors shadow-2xs"
                      >
                        <span>Open Request</span>
                        <ArrowRight className="w-3 h-3 text-ink-muted" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
