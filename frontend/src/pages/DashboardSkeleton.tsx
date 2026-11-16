import type { CSSProperties } from "react";
import "./DashboardSkeleton.css";

function SkeletonBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`dashboard-skeleton-block ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export default function DashboardSkeleton() {
  return (
    <section
      className="dashboard-skeleton"
      aria-label="Loading dashboard"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading your dashboard…
      </p>

      <div className="dashboard-skeleton-hero">
        <div>
          <SkeletonBlock className="dashboard-skeleton-kicker" />
          <SkeletonBlock className="dashboard-skeleton-title" />
          <SkeletonBlock className="dashboard-skeleton-subtitle" />
          <SkeletonBlock className="dashboard-skeleton-button" />
        </div>
        <div className="dashboard-skeleton-posture">
          <SkeletonBlock className="dashboard-skeleton-label" />
          <SkeletonBlock className="dashboard-skeleton-subtitle" />
          <SkeletonBlock className="dashboard-skeleton-label" />
        </div>
      </div>

      <div className="dashboard-skeleton-shortcuts" role="group" aria-label="Loading next steps">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="dashboard-skeleton-shortcut" key={index}>
            <SkeletonBlock className="dashboard-skeleton-icon" />
            <SkeletonBlock className="dashboard-skeleton-label" />
            <SkeletonBlock className="dashboard-skeleton-subtitle" />
          </div>
        ))}
      </div>

      <div className="dashboard-skeleton-requests" role="group" aria-label="Loading recent requests">
        <SkeletonBlock className="dashboard-skeleton-title" />
        {Array.from({ length: 3 }, (_, index) => (
          <div className="dashboard-skeleton-request" key={index}>
            <SkeletonBlock className="dashboard-skeleton-icon" />
            <SkeletonBlock className="dashboard-skeleton-subtitle" />
            <SkeletonBlock className="dashboard-skeleton-label" />
          </div>
        ))}
      </div>
    </section>
  );
}
