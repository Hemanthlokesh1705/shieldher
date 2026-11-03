import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useVerification } from "../../context/VerificationContext";
import { Check, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";

const STEPS = [
  { id: 1, label: "Consent", path: "/verification/consent" },
  { id: 2, label: "Upload", path: "/verification/upload" },
  { id: 3, label: "Suitability", path: "/verification/quality" },
  { id: 4, label: "Analysis", path: "/verification/analysis" },
  { id: 5, label: "Findings", path: "/verification/forensics" },
  { id: 6, label: "Online Search", path: "/verification/online-search" },
  { id: 7, label: "Incident Info", path: "/verification/incident-details" },
  { id: 8, label: "Evidence", path: "/verification/evidence-review" },
  { id: 9, label: "Report", path: "/verification/report" },
];

export const VerificationLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { uploadData, verificationData, activeCase, resetWorkflow } =
    useVerification();

  const getCurrentStepIndex = () => {
    const idx = STEPS.findIndex((s) => s.path === location.pathname);
    return idx >= 0 ? idx : 0;
  };

  const currentIdx = getCurrentStepIndex();

  const canNavigateToStep = (index: number) => {
    if (index === 0) return true;
    if (index === 1) return true;
    if (index === 2) return Boolean(uploadData);
    if (index === 3) return Boolean(uploadData);
    if (index === 4) return Boolean(verificationData || uploadData);
    if (index === 5) return Boolean(uploadData);
    if (index === 6) return true;
    if (index === 7) return true;
    if (index === 8) return Boolean(activeCase);
    return true;
  };

  const handleStepClick = (index: number, path: string) => {
    if (canNavigateToStep(index)) {
      navigate(path);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wizard Header & Stepper Track */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-sage/40 text-brand-forest text-xs font-semibold mb-1 border border-brand-border">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Confidential Verification &bull; Step {currentIdx + 1} of {STEPS.length}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-ink-primary font-heading tracking-tight">
              {STEPS[currentIdx].label}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {activeCase && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-canvas-sand text-ink-primary border border-ink-border/60">
                Ref: {activeCase.case_number || activeCase.id.substring(0, 8)}
              </span>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle transition-colors border border-ink-border/50 hover:border-ink-border"
              onClick={() => {
                if (
                  window.confirm(
                    "Start a new check? In-flight changes will be cleared."
                  )
                ) {
                  resetWorkflow();
                  navigate("/verification/consent");
                }
              }}
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
              <span>Start Over</span>
            </button>
          </div>
        </div>

        {/* Progress Stepper Track */}
        <div className="hidden lg:flex items-center justify-between w-full pt-1">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isActive = idx === currentIdx;
            const isClickable = canNavigateToStep(idx);

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-1.5 transition-all focus:outline-none group",
                    !isClickable && "opacity-40 cursor-not-allowed"
                  )}
                  onClick={() => handleStepClick(idx, step.path)}
                  disabled={!isClickable}
                  title={`${step.id}. ${step.label}`}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs",
                      isActive
                        ? "bg-brand-forest text-surface-pearl ring-4 ring-brand-sage scale-105"
                        : isCompleted
                        ? "bg-brand-rich text-surface-pearl"
                        : "bg-[#FAF8F5] text-ink-secondary border border-ink-border group-hover:border-brand-rich"
                    )}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.id}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium tracking-tight whitespace-nowrap",
                      isActive
                        ? "text-brand-forest font-bold"
                        : isCompleted
                        ? "text-ink-primary font-semibold"
                        : "text-ink-muted"
                    )}
                  >
                    {step.label}
                  </span>
                </button>

                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                      idx < currentIdx ? "bg-brand-forest" : "bg-ink-border/60"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile & Tablet Compact Progress Indicator */}
        <div className="lg:hidden mt-2">
          <div className="w-full bg-[#EAE5DA] rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand-forest h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentIdx + 1) / STEPS.length) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-ink-muted mt-2 font-medium">
            <span>
              Step {currentIdx + 1}: <strong className="text-ink-primary">{STEPS[currentIdx].label}</strong>
            </span>
            <span>
              {currentIdx + 1} of {STEPS.length}
            </span>
          </div>
        </div>
      </div>

      {/* Active Step Content */}
      <Outlet />
    </div>
  );
};

export default VerificationLayout;
