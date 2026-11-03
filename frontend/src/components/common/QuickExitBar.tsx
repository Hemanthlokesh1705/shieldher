import React, { useEffect } from "react";
import { LogOut, Shield } from "lucide-react";

interface QuickExitBarProps {
  redirectUrl?: string;
}

export const QuickExitBar: React.FC<QuickExitBarProps> = ({
  redirectUrl = import.meta.env.VITE_QUICK_EXIT_URL || "https://weather.com",
}) => {
  const handleQuickExit = () => {
    if (typeof window !== "undefined") {
      // Replace location to overwrite sensitive history state immediately
      window.location.replace(redirectUrl);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Instant Escape key trigger
      if (e.key === "Escape") {
        handleQuickExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redirectUrl]);

  return (
    <div
      className="w-full bg-[#192B29] text-surface-pearl px-4 py-2 flex items-center justify-between text-xs z-50 select-none border-b border-white/10"
      role="region"
      aria-label="Emergency quick exit bar"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleQuickExit}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#C73E3A] hover:bg-[#A9322E] active:bg-[#8F2723] text-white font-semibold text-xs transition-colors shadow-2xs focus:outline-none focus:ring-2 focus:ring-red-400"
          title="Leave this site immediately and replace history (Press ESC)"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Quick Exit</span>
          <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 bg-black/40 rounded text-[10px] font-mono text-white/90">
            Esc
          </kbd>
        </button>
        <span className="hidden sm:inline text-neutral-300 text-[11px]">
          Instantly switches away to a neutral weather service.
        </span>
      </div>

      <div className="flex items-center gap-2 text-neutral-300">
        <Shield className="w-3.5 h-3.5 text-accent-gold" />
        <span className="text-[11px] font-medium tracking-wide">
          Private & Confidential
        </span>
      </div>
    </div>
  );
};

export default QuickExitBar;
