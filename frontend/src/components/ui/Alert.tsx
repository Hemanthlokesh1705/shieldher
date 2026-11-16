import * as React from "react";
import { cn } from "../../lib/utils";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "destructive";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", children, ...props }, ref) => {
    const variantStyles = {
      info: "bg-status-infoBg text-status-info border-status-infoBorder",
      success: "bg-status-successBg text-status-success border-status-successBorder",
      warning: "bg-status-warningBg text-status-warning border-status-warningBorder",
      destructive: "bg-status-errorBg text-status-error border-status-errorBorder",
    };

    const icons = {
      info: <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />,
      success: <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />,
      warning: <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />,
      destructive: <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />,
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded-md border p-4 flex gap-3 text-sm leading-relaxed",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {icons[variant]}
        <div className="flex-1 space-y-1">{children}</div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("font-medium tracking-tight leading-none mb-1 text-ink", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs leading-normal opacity-90", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";
