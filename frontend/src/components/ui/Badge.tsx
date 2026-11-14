import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-surface-subtle text-brand-forest border-brand-border",
    secondary: "bg-canvas-subtle text-ink-secondary border-ink-border",
    success: "bg-status-successBg text-status-success border-status-successBorder",
    warning: "bg-status-warningBg text-status-warning border-status-warningBorder",
    destructive: "bg-status-errorBg text-status-error border-status-errorBorder",
    outline: "bg-transparent text-ink border-ink-border",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}