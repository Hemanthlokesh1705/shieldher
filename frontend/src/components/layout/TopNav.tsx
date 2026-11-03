import React from "react";
import { useLocation, Link } from "react-router-dom";
import { PlusCircle, Menu, ShieldCheck } from "lucide-react";

interface TopNavProps {
  onMenuClick?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onMenuClick }) => {
  const location = useLocation();

  const getPageMeta = () => {
    const path = location.pathname;
    if (path.startsWith("/verification"))
      return {
        title: "Check an Image",
        subtitle: "Guided, confidential analysis of suspected manipulated media",
      };
    if (path.startsWith("/cases/"))
      return {
        title: "Request Details",
        subtitle: "Review findings, evidence records and formal complaint draft",
      };
    if (path === "/cases")
      return {
        title: "My Requests",
        subtitle: "Track your preserved evidence and previous image assessments",
      };
    if (path === "/help")
      return {
        title: "Help & Safety",
        subtitle: "Official 24/7 helplines, evidence preservation guides and FAQs",
      };
    if (path === "/settings")
      return {
        title: "Account & Privacy",
        subtitle: "Manage personal preferences, retention policies and data deletion",
      };
    if (path === "/reviewer" || path.startsWith("/moderator"))
      return {
        title: "Moderator Portal",
        subtitle: "Staff triage queue and examiner adjudication workspace",
      };
    return {
      title: "Home",
      subtitle: "Your private, secure workspace for digital media protection",
    };
  };

  const meta = getPageMeta();
  const isChecking = location.pathname.startsWith("/verification");

  return (
    <header className="h-16 px-4 sm:px-6 bg-surface-pearl border-b border-ink-border flex items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="p-1.5 rounded-lg border border-ink-border text-ink-secondary hover:text-ink hover:bg-canvas-subtle md:hidden focus:outline-none focus:ring-2 focus:ring-brand-rich transition-colors"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h1 className="text-base sm:text-lg font-bold text-ink-primary font-heading tracking-tight leading-none">
            {meta.title}
          </h1>
          <p className="hidden sm:block text-xs text-ink-muted mt-1 font-sans">
            {meta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-sage/30 border border-brand-sage text-[11px] font-medium text-brand-forest">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-forest" />
          <span>Encrypted Session</span>
        </div>

        {!isChecking && (
          <Link
            to="/verification/consent"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-rich focus:ring-offset-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Check an Image</span>
          </Link>
        )}
      </div>
    </header>
  );
};

export default TopNav;
