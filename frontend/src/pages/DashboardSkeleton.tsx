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

      <div className="dashboard-skeleton-heading">
        <div>
          <SkeletonBlock className="dashboard-skeleton-kicker" />
          <SkeletonBlock className="dashboard-skeleton-title" />
          <SkeletonBlock className="dashboard-skeleton-subtitle" />
        </div>
        <SkeletonBlock className="dashboard-skeleton-button" />
      </div>

      <div
        className="dashboard-skeleton-stats"
        role="group"
        aria-label="Loading key metrics"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div className="dashboard-skeleton-stat" key={index}>
            <div className="dashboard-skeleton-stat-top">
              <SkeletonBlock className="dashboard-skeleton-label" />
              <SkeletonBlock className="dashboard-skeleton-stat-icon" />
            </div>
            <SkeletonBlock className="dashboard-skeleton-value" />
            <SkeletonBlock className="dashboard-skeleton-trend" />
          </div>
        ))}
      </div>

      <div
        className="dashboard-skeleton-chart"
        role="group"
        aria-label="Loading activity chart"
      >
        <div className="dashboard-skeleton-chart-heading">
          <div>
            <SkeletonBlock className="dashboard-skeleton-label" />
            <SkeletonBlock className="dashboard-skeleton-chart-title" />
          </div>
          <SkeletonBlock className="dashboard-skeleton-filter" />
        </div>
        <div className="dashboard-skeleton-chart-area" aria-hidden="true">
          <div className="dashboard-skeleton-y-axis">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonBlock className="dashboard-skeleton-axis-label" key={index} />
            ))}
          </div>
          <div className="dashboard-skeleton-plot">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="dashboard-skeleton-bar-group" key={index}>
                <SkeletonBlock
                  className="dashboard-skeleton-bar"
                  style={{ height: `${34 + ((index * 29) % 54)}%` }}
                />
                <SkeletonBlock className="dashboard-skeleton-x-label" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="dashboard-skeleton-table"
        role="group"
        aria-label="Loading recent requests"
      >
        <div className="dashboard-skeleton-table-heading">
          <div>
            <SkeletonBlock className="dashboard-skeleton-label" />
            <SkeletonBlock className="dashboard-skeleton-chart-title" />
          </div>
          <SkeletonBlock className="dashboard-skeleton-filter" />
        </div>
        <div className="dashboard-skeleton-table-head" aria-hidden="true">
          {["Reference", "Request", "Status", "Date", ""].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div className="dashboard-skeleton-table-row" key={index} aria-hidden="true">
            <SkeletonBlock className="dashboard-skeleton-cell dashboard-skeleton-cell-short" />
            <div className="dashboard-skeleton-request-cell">
              <SkeletonBlock className="dashboard-skeleton-request-icon" />
              <SkeletonBlock className="dashboard-skeleton-cell dashboard-skeleton-cell-long" />
            </div>
            <SkeletonBlock className="dashboard-skeleton-status" />
            <SkeletonBlock className="dashboard-skeleton-cell dashboard-skeleton-cell-date" />
            <SkeletonBlock className="dashboard-skeleton-row-action" />
          </div>
        ))}
      </div>
    </section>
  );
}
