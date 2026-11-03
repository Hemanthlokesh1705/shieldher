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
    default: "bg-teal-50 text-teal-700 border-teal-200",
    secondary: "bg-canvas-subtle text-ink-secondary border-ink-border",
    success: "bg-sage-50 text-sage-600 border-green-200",
    warning: "bg-amber-50 text-amber-600 border-amber-200",
    destructive: "bg-rose-50 text-rose-600 border-rose-200",
    outline: "bg-transparent text-ink border-ink-border",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
