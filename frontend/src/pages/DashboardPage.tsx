import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCases } from "../services/api";
import { CaseItem } from "../types/models";
import {
  Shield,
  PlusCircle,
  Lock,
  ArrowRight,
  FileCheck,
  AlertTriangle,
  LifeBuoy,
  ChevronRight,
  RotateCcw,
  ShieldAlert,
  FileText,
  KeyRound,
} from "lucide-react";
import DashboardSkeleton from "./DashboardSkeleton";
import "./DashboardPage.css";

export default function DashboardPage() {
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

  if (loading) {
    return <DashboardSkeleton />;
  }

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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-subtle/50 text-brand-forest border border-brand-border">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-rich" />
          Report ready
        </span>
      );
    }
    if (item.review_status === "UNDER_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-subtle text-ink-secondary border border-ink-border">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-rich" />
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

  const shortcuts = [
    {
      to: "/verification/consent",
      index: "01",
      title: "9-Step Verification",
      description:
        "A guided face check, deepfake probability, and image noise diagnostics.",
      action: "Start a private check",
      icon: ShieldAlert,
      className: "dashboard-shortcut-check",
    },
    {
      to: "/help",
      index: "02",
      title: "Help & Safety",
      description:
        "Find national helplines, evidence preservation guides, and legal resources.",
      action: "Explore safety resources",
      icon: LifeBuoy,
      className: "dashboard-shortcut-help",
    },
    {
      to: "/settings",
      index: "03",
      title: "Account & Privacy",
      description:
        "Review your account options and choose a retention period for each image check.",
      action: "Manage your privacy",
      icon: KeyRound,
      className: "dashboard-shortcut-account",
    },
  ];

  return (
    <div className="dashboard-page pb-10">
      <section
        className="dashboard-hero-card"
        aria-labelledby="dashboard-welcome-title"
      >
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-copy">
            <p className="dashboard-eyebrow">Private evidence workspace</p>
            <h2 id="dashboard-welcome-title">Review your requests</h2>
            <p className="dashboard-hero-description">
              Verify suspicious imagery, review forensic diagnostics, and
              prepare an incident package when you are ready. You remain in
              control at every step.
            </p>
            <div className="dashboard-hero-actions">
              <Link to="/verification/consent" className="dashboard-primary-action">
                <PlusCircle aria-hidden="true" />
                <span>Check an image</span>
                <ArrowRight className="dashboard-action-arrow" aria-hidden="true" />
              </Link>
              <Link to="/cases" className="dashboard-secondary-action">
                <FileText aria-hidden="true" />
                <span>View my requests</span>
              </Link>
            </div>
          </div>

          <aside className="dashboard-posture" aria-label="Active privacy posture">
            <div className="dashboard-posture-heading">
              <div className="dashboard-posture-icon">
                <Shield aria-hidden="true" />
              </div>
              <div>
                <span className="dashboard-posture-label">Privacy posture</span>
                <span className="dashboard-posture-status">
                  <span aria-hidden="true" />
                  Your workspace is private
                </span>
              </div>
            </div>
            <div className="dashboard-posture-row">
              <span>Memory buffering</span>
              <strong>Ephemeral</strong>
            </div>
            <div className="dashboard-posture-row">
              <span>Client-side blur</span>
              <strong>Enabled</strong>
            </div>
            <Link to="/settings" className="dashboard-posture-link">
              Review privacy settings <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        </div>

      </section>

      <section
        className="dashboard-guarantee"
        aria-label="Confidentiality guarantee"
      >
        <div className="dashboard-guarantee-icon">
          <Lock aria-hidden="true" />
        </div>
        <div className="dashboard-guarantee-copy">
          <span className="dashboard-section-eyebrow">Your media stays yours</span>
          <p>
            Uploads are analyzed solely for your verification report. ShieldHer
            never exposes, indexes, or shares your media with external
            commercial aggregators or model trainers.
          </p>
        </div>
      </section>

      <section className="dashboard-shortcuts-section" aria-labelledby="dashboard-tools-title">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-section-eyebrow">Next steps</span>
            <h3 id="dashboard-tools-title">Choose where to continue</h3>
          </div>
          <span className="dashboard-step-count">3 options</span>
        </div>
        <div className="dashboard-shortcuts">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <div
                key={shortcut.to}
                className="dashboard-shortcut-wrap"
              >
                <Link to={shortcut.to} className={`dashboard-shortcut ${shortcut.className}`}>
                  <span className="dashboard-shortcut-index">{shortcut.index}</span>
                  <span className="dashboard-shortcut-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h4>
                    {shortcut.title}
                    <ChevronRight aria-hidden="true" />
                  </h4>
                  <p>{shortcut.description}</p>
                  <span className="dashboard-shortcut-action">
                    {shortcut.action}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="dashboard-requests"
        aria-labelledby="dashboard-requests-title"
      >
        <div className="dashboard-requests-heading">
          <div>
            <span className="dashboard-section-eyebrow">Your saved work</span>
            <h3 id="dashboard-requests-title">Recent requests</h3>
            <p>Private image checks and preserved evidence in one place.</p>
          </div>
          <Link to="/cases" className="dashboard-view-all">
            View all requests <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        {error ? (
          <div className="dashboard-request-message dashboard-request-error">
            <div className="dashboard-request-message-icon">
              <AlertTriangle aria-hidden="true" />
            </div>
            <div>
              <strong>We couldn’t load your requests</strong>
              <p>{error}</p>
            </div>
            <button type="button" onClick={loadRequests} className="dashboard-retry-button">
              <RotateCcw aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="dashboard-request-empty">
            <div className="dashboard-empty-orbit" aria-hidden="true">
              <Shield />
            </div>
            <div>
              <h4>Your workspace is ready when you are.</h4>
              <p>
                Start with an image check. You decide what to share and whether
                to prepare an incident report.
              </p>
            </div>
            <Link to="/verification/consent" className="dashboard-empty-action">
              <PlusCircle aria-hidden="true" />
              Start a check
            </Link>
          </div>
        ) : (
          <div className="dashboard-request-list">
            {requests.slice(0, 5).map((item) => (
              <article
                key={item.id}
                className="dashboard-request-item"
              >
                <div className="dashboard-request-file-icon">
                  <FileCheck aria-hidden="true" />
                </div>
                <div className="dashboard-request-details">
                  <span className="dashboard-request-reference">
                    {item.case_number || item.id.substring(0, 8)}
                  </span>
                  <h4>{item.title || "Private Image Assessment"}</h4>
                </div>
                <div className="dashboard-request-status">{getStatusBadge(item)}</div>
                <time className="dashboard-request-date" dateTime={item.created_at}>
                  {formatDate(item.created_at)}
                </time>
                <Link
                  to={`/cases/${item.id}`}
                  className="dashboard-request-open"
                  aria-label={`View request ${item.case_number || item.id.substring(0, 8)}`}
                >
                  <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
