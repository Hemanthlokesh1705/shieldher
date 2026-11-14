import * as React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "subtle";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-rich focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none rounded-md";

    const variantStyles = {
      primary:
        "bg-brand-forest text-white hover:bg-brand-hover active:bg-brand-hover shadow-sm",
      secondary:
        "bg-canvas-subtle text-ink hover:bg-canvas-muted active:bg-ink-border border border-ink-border",
      outline:
        "border border-ink-border bg-white text-ink hover:bg-canvas-subtle active:bg-canvas-muted",
      ghost:
        "text-ink-secondary hover:text-ink hover:bg-canvas-subtle active:bg-canvas-muted",
      destructive:
        "bg-status-error text-white hover:bg-status-error/90 active:bg-status-error shadow-sm",
      subtle:
        "bg-brand-sage text-brand-forest hover:bg-brand-light border border-brand-border",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";