import React, { useState } from "react";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";

interface SensitiveImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
  defaultBlurred?: boolean;
}

export const SensitiveImage: React.FC<SensitiveImageProps> = ({
  src,
  alt,
  className,
  aspectRatio = "aspect-video",
  defaultBlurred = true,
}) => {
  const [isBlurred, setIsBlurred] = useState(defaultBlurred);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-ink-border bg-canvas-subtle group select-none",
        aspectRatio,
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "h-full w-full object-contain transition-[filter] duration-300",
          isBlurred ? "blur-xl filter" : "blur-0"
        )}
        draggable={false}
      />

      {isBlurred && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-pearl/85 p-4 text-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink-border bg-white text-xs font-medium text-ink mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-brand-forest" />
            <span>Image preview is blurred</span>
          </div>
          <p className="text-sm text-ink-secondary mb-3 max-w-xs">
            Reveal it only when you feel ready.
          </p>
          <button
            type="button"
            onClick={() => setIsBlurred(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ink-border bg-white text-sm font-medium text-ink hover:bg-canvas-subtle transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Reveal Preview</span>
          </button>
        </div>
      )}

      {!isBlurred && (
        <button
          type="button"
          onClick={() => setIsBlurred(true)}
          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-ink-border bg-white text-ink text-xs hover:bg-canvas-subtle transition-colors"
          title="Re-blur preview"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Blur</span>
        </button>
      )}
    </div>
  );
};
