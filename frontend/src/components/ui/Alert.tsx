import * as React from "react";
import { cn } from "../../lib/utils";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "destructive";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", children, ...props }, ref) => {
    const variantStyles = {
      info: "bg-slate-50 text-slate-700 border-sky-200",
      success: "bg-sage-50 text-sage-700 border-green-200",
      warning: "bg-amber-50 text-amber-700 border-amber-200",
      destructive: "bg-rose-50 text-rose-700 border-rose-200",
    };

    const icons = {
      info: <Info className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />,
      success: <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0 mt-0.5" />,
      warning: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />,
      destructive: <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />,
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative w-full rounded border p-4 flex gap-3 text-sm leading-relaxed",
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
