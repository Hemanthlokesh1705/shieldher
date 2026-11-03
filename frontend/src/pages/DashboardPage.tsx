import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
import { listCases } from "../services/api";
import { CaseItem } from "../types/models";
import {
  Shield,
  PlusCircle,
  Lock,
  ArrowRight,
  Clock,
  FileCheck,
  AlertTriangle,
  LifeBuoy,
  ChevronRight,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  FileText,
  KeyRound,
} from "lucide-react";


export default function DashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCases();
      setRequests(data || []);
    } catch {
      setError(
        "Unable to load your requests at this moment. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

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

  const userGreeting = user?.displayName ? `, ${user.displayName}` : "";

  return (
    <div className="space-y-7 pb-10">
      {/* Editorial Hero Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-sm relative overflow-hidden"
      >
        {/* Soft Background Accent */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 bg-brand-sage/30 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-sage/40 border border-brand-border text-brand-forest text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-accent-gold" />
              <span>Private & Confidential Sanctuary</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-ink font-heading leading-tight">
              Welcome to your private space{userGreeting}
            </h2>

            <p className="text-sm sm:text-base text-ink-secondary font-sans leading-relaxed max-w-2xl">
              You can verify suspicious imagery, examine objective forensic diagnostics,
              and assemble court-admissible incident packages on your own terms.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                to="/verification/consent"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow focus:outline-none focus:ring-2 focus:ring-brand-rich focus:ring-offset-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Check an image now</span>
              </Link>

              <Link
                to="/cases"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-pearl border border-ink-border hover:bg-canvas-subtle text-ink font-medium text-xs sm:text-sm transition-colors"
              >
                <FileText className="w-4 h-4 text-ink-muted" />
                <span>View My Requests</span>
              </Link>
            </div>
          </div>

          {/* Quick Security Snapshot Pill Box */}
          <div className="lg:col-span-4 bg-[#F8F6F0] rounded-xl p-5 border border-ink-border/70 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-ink-primary font-heading uppercase tracking-wider">
              <Shield className="w-4 h-4 text-brand-forest" />
              <span>Active Privacy Posture</span>
            </div>

            <div className="space-y-2 text-xs text-ink-secondary">
              <div className="flex items-center justify-between pb-1.5 border-b border-ink-border/50">
                <span>Memory Buffering</span>
                <span className="font-semibold text-brand-forest">Ephemeral</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-ink-border/50">
                <span>Client-Side Blur</span>
                <span className="font-semibold text-brand-forest">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Instant Exit</span>
                <span className="font-mono text-[10px] bg-canvas-sand px-1.5 py-0.5 rounded text-ink-primary">
                  Esc
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Reassuring Privacy Guarantees */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#FAF9F5] border border-ink-border/70 flex items-start gap-3.5 text-xs sm:text-sm text-ink-secondary leading-relaxed shadow-2xs">
        <div className="w-8 h-8 rounded-lg bg-brand-sage/50 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <strong className="text-ink font-semibold">
            Confidentiality Guarantee:
          </strong>{" "}
          Your uploads are analyzed solely for your own verification report. ShieldHer never exposes, indexes, or shares your media with external commercial aggregators or model trainers.
        </div>
      </div>

      {/* 3 Core Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/verification/consent"
          className="p-5 rounded-2xl bg-surface-pearl border border-ink-border/80 hover:border-brand-rich/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-ink font-heading group-hover:text-brand-forest flex items-center gap-1.5 transition-colors">
              <span>9-Step Verification</span>
              <ChevronRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-0.5 transition-transform" />
            </h4>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
              Step-by-step human face check, deepfake probability, and ELA noise-residual diagnostic.
            </p>
          </div>
          <span className="mt-4 text-xs font-semibold text-brand-forest flex items-center gap-1">
            Start check <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          to="/help"
          className="p-5 rounded-2xl bg-surface-pearl border border-ink-border/80 hover:border-brand-rich/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-ink font-heading group-hover:text-brand-forest flex items-center gap-1.5 transition-colors">
              <span>Help & Safety Resources</span>
              <ChevronRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-0.5 transition-transform" />
            </h4>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
              National cyber helplines (1930 India, StopNCII, TakeItDown), preservation checklists, and legal guidance.
            </p>
          </div>
          <span className="mt-4 text-xs font-semibold text-brand-forest flex items-center gap-1">
            Access helplines <ArrowRight className="w-3 h-3" />
          </span>
        </Link>

        <Link
          to="/settings"
          className="p-5 rounded-2xl bg-surface-pearl border border-ink-border/80 hover:border-brand-rich/50 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <KeyRound className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-ink font-heading group-hover:text-brand-forest flex items-center gap-1.5 transition-colors">
              <span>Account & Retention</span>
              <ChevronRight className="w-3.5 h-3.5 text-ink-muted group-hover:translate-x-0.5 transition-transform" />
            </h4>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
              Manage data retention timers, pseudonym preferences, or exercise your right to permanent data erasure.
            </p>
          </div>
          <span className="mt-4 text-xs font-semibold text-brand-forest flex items-center gap-1">
            Manage privacy <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-ink-border/60 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-ink font-heading">
              My Requests
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Review previous image checks, preserved evidence hashes, and generated incident reports.
            </p>
          </div>

          {requests.length > 0 && (
            <Link
              to="/cases"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-forest hover:text-brand-rich transition-colors"
            >
              <span>View all ({requests.length})</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {error ? (
          <div className="p-6">
            <div className="p-4 rounded-xl bg-accent-goldSoft border border-accent-gold/40 text-ink flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent-gold flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={loadRequests}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-pearl border border-accent-gold/50 text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors flex-shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-xs text-ink-muted">
            <Clock className="w-5 h-5 mx-auto mb-2 animate-spin text-brand-forest" />
            <span>Loading your private records…</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-ink font-heading">
              Nothing here yet.
            </h4>
            <p className="text-xs text-ink-secondary mt-1.5 max-w-sm mx-auto leading-relaxed mb-5">
              Start by checking an image. You decide what information to provide
              and whether to prepare an official report draft.
            </p>
            <Link
              to="/verification/consent"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-forest text-surface-pearl text-xs font-semibold hover:bg-brand-rich transition-all shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Check an image</span>
            </Link>
          </div>
        ) : (
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
                {requests.slice(0, 5).map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-canvas-subtle/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-ink">
                      <span className="px-2 py-0.5 rounded bg-canvas-sand text-ink text-[11px] font-medium">
                        {item.case_number || item.id.substring(0, 8)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-3.5 h-3.5 text-brand-forest flex-shrink-0" />
                        <span className="truncate max-w-xs font-semibold">
                          {item.title || "Private Image Assessment"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">
                      {getStatusBadge(item)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-ink-secondary whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <Link
                        to={`/cases/${item.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-ink-border bg-surface-pearl text-ink text-xs font-semibold hover:border-brand-rich hover:text-brand-forest transition-colors shadow-2xs"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3 h-3 text-ink-muted" />
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
