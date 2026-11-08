import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../firebase/AuthContext";
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
  Sparkles,
  ShieldAlert,
  FileText,
  KeyRound,
} from "lucide-react";
import DashboardSkeleton from "./DashboardSkeleton";
import "./DashboardPage.css";

export default function DashboardPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
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
      title: "Account & Retention",
      description:
        "Manage retention preferences, pseudonyms, or permanent data erasure.",
      action: "Manage your privacy",
      icon: KeyRound,
      className: "dashboard-shortcut-account",
    },
  ];

  return (
    <div className="dashboard-page pb-10">
      <motion.section
        className="dashboard-hero-card"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
        aria-labelledby="dashboard-welcome-title"
      >
        <div className="dashboard-hero-art" aria-hidden="true">
          <img src="/loginhero.jpeg" alt="" />
          <span />
        </div>
        <div className="dashboard-hero-orbit dashboard-hero-orbit-one" aria-hidden="true" />
        <div className="dashboard-hero-orbit dashboard-hero-orbit-two" aria-hidden="true" />

        <div className="dashboard-hero-content">
          <div className="dashboard-hero-copy">
            <motion.div
              className="dashboard-eyebrow"
              initial={reduceMotion ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.4, delay: 0.12 }}
            >
              <span className="dashboard-eyebrow-pulse" aria-hidden="true" />
              <Sparkles className="dashboard-sparkle" aria-hidden="true" />
              <span>Private & Confidential Sanctuary</span>
            </motion.div>
            <motion.h2
              id="dashboard-welcome-title"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.45, delay: 0.18 }}
            >
              Your space.
              <br />
              <span>Your next step.</span>
              {userGreeting && (
                <span className="dashboard-user-greeting">
                  Welcome back{userGreeting}
                </span>
              )}
            </motion.h2>
            <motion.p
              className="dashboard-hero-description"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.45, delay: 0.24 }}
            >
              Verify suspicious imagery, review forensic diagnostics, and
              prepare an incident package when you are ready. You remain in
              control at every step.
            </motion.p>
            <motion.div
              className="dashboard-hero-actions"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.45, delay: 0.3 }}
            >
              <Link to="/verification/consent" className="dashboard-primary-action">
                <PlusCircle aria-hidden="true" />
                <span>Check an image</span>
                <ArrowRight className="dashboard-action-arrow" aria-hidden="true" />
              </Link>
              <Link to="/cases" className="dashboard-secondary-action">
                <FileText aria-hidden="true" />
                <span>View my requests</span>
              </Link>
            </motion.div>
          </div>

          <motion.aside
            className="dashboard-posture"
            aria-label="Active privacy posture"
            initial={reduceMotion ? false : { opacity: 0, x: 22, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, delay: 0.2 }}
          >
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
          </motion.aside>
        </div>

        <div className="dashboard-hero-footer" aria-hidden="true">
          <span>SHIELDHER</span>
          <span>01 / PRIVATE WORKSPACE</span>
        </div>
      </motion.section>

      <motion.section
        className="dashboard-guarantee"
        aria-label="Confidentiality guarantee"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
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
        <div className="dashboard-guarantee-mark" aria-hidden="true">
          <Shield />
          <span>PRIVATE<br />BY DESIGN</span>
        </div>
      </motion.section>

      <section className="dashboard-shortcuts-section" aria-labelledby="dashboard-tools-title">
        <motion.div
          className="dashboard-section-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
        >
          <div>
            <span className="dashboard-section-eyebrow">A little at a time</span>
            <h3 id="dashboard-tools-title">Choose what you need</h3>
          </div>
          <span className="dashboard-step-count">3 ways to continue</span>
        </motion.div>
        <div className="dashboard-shortcuts">
          {shortcuts.map((shortcut, index) => {
            const Icon = shortcut.icon;
            return (
              <motion.div
                key={shortcut.to}
                className="dashboard-shortcut-wrap"
                initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.45,
                  delay: reduceMotion ? 0 : index * 0.1,
                }}
                whileHover={reduceMotion ? undefined : { y: -6 }}
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
                  <span className="dashboard-shortcut-glow" aria-hidden="true" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <motion.section
        className="dashboard-requests"
        aria-labelledby="dashboard-requests-title"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: reduceMotion ? 0 : 0.45 }}
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
            {requests.slice(0, 5).map((item, index) => (
              <motion.article
                key={item.id}
                className="dashboard-request-item"
                initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.35,
                  delay: reduceMotion ? 0 : index * 0.07,
                }}
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
              </motion.article>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
