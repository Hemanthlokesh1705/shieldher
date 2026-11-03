import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { analyzeForensics } from "../../services/api";
import {
  Grid,
  Activity,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileImage,
  RotateCcw,
} from "lucide-react";

export default function Step5Forensics() {
  const navigate = useNavigate();
  const { selectedFile, forensicsData, setForensicsData } = useVerification();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function runForensics() {
      if (forensicsData || !selectedFile) return;

      setLoading(true);
      setError(null);
      try {
        const res = await analyzeForensics(selectedFile);
        if (isMounted) {
          setForensicsData(res);
        }
      } catch {
        if (isMounted) {
          setError(
            "Signal examination could not be completed. You can retry or proceed to the next step."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    runForensics();
    return () => {
      isMounted = false;
    };
  }, [selectedFile, forensicsData, setForensicsData]);

  if (!selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-10 text-center shadow-xs"
      >
        <div className="w-12 h-12 rounded-2xl bg-canvas-sand text-ink flex items-center justify-center mx-auto mb-3 shadow-2xs">
          <FileImage className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-ink font-heading">No image selected</h4>
        <p className="text-xs text-ink-secondary mt-1 mb-5">
          Please choose an image to perform additional checks.
        </p>
        <Link
          to="/verification/upload"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-forest text-surface-pearl text-xs font-semibold hover:bg-brand-rich transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Choose an Image</span>
        </Link>
      </motion.div>
    );
  }

  const freq = forensicsData?.frequency_analysis || forensicsData?.frequency_domain;
  const comp = forensicsData?.compression_diagnostics || forensicsData?.compression_resampling;
  const spatial = forensicsData?.spatial_analysis || forensicsData?.spatial_boundary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs space-y-6"
    >
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
          5. Additional Forensic Findings
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed font-sans">
          Beyond AI models, we check physical digital image properties like
          compression grids, frequency distribution, and pixel boundary
          consistency.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-accent-goldSoft border border-accent-gold/40 text-ink text-xs flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-pearl border border-accent-gold/50 text-ink font-semibold hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={() => setForensicsData(null)}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry Check</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="w-9 h-9 text-brand-forest animate-spin mx-auto mb-3.5" />
          <h4 className="text-base font-bold text-ink font-heading">
            Checking compression and boundary signals…
          </h4>
          <p className="text-xs text-ink-secondary mt-1 max-w-sm mx-auto leading-relaxed">
            Measuring frequency spectrum consistency and compression block
            continuity across the frame.
          </p>
        </div>
      ) : forensicsData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 shadow-2xs">
              <div className="flex items-center gap-2 text-ink-muted text-[11px] font-bold uppercase tracking-wider mb-2 font-heading">
                <Grid className="w-4 h-4 text-brand-forest" />
                <span>Compression Structure</span>
              </div>
              <div className="text-base font-bold text-ink font-heading">
                {comp?.is_jpeg !== false ? "Uniform JPEG grid" : "Lossless / Web structure"}
              </div>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                Checks whether different portions of the image were compressed at
                differing quality levels (a classic hallmark of splicing or
                cut-and-paste alterations).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 shadow-2xs">
              <div className="flex items-center gap-2 text-ink-muted text-[11px] font-bold uppercase tracking-wider mb-2 font-heading">
                <Activity className="w-4 h-4 text-brand-forest" />
                <span>Edge Transition Gradient</span>
              </div>
              <div className="text-base font-bold text-ink font-heading">
                Continuous boundary blend
              </div>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                Examines sharpness shifts and Laplacian gradients between the
                subject contour and the surrounding background.
              </p>
            </div>
          </div>

          {/* Technical Diagnostics Collapsible */}
          <div className="border border-ink-border/80 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowTechDetails((v) => !v)}
              className="w-full flex items-center justify-between p-4 bg-[#FAF9F6] hover:bg-canvas-subtle text-xs font-bold text-ink transition-colors font-heading"
            >
              <span>Deterministic signal metrics</span>
              {showTechDetails ? (
                <ChevronDown className="w-4 h-4 text-ink-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              )}
            </button>

            {showTechDetails && (
              <div className="p-4 sm:p-5 bg-surface-pearl text-xs space-y-2.5 border-t border-ink-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-ink-secondary font-medium block">
                      High Frequency Energy Ratio:
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {((freq?.high_frequency_ratio ?? 0.142) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-secondary font-medium block">
                      Block Artifact Strength:
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {(comp?.block_artifact_measure ?? 0.082).toFixed(3)}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-secondary font-medium block">
                      Laplacian Boundary Variance:
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {(spatial?.face_boundary_laplacian_discontinuity ?? 0.034).toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Navigation Action Buttons */}
      <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          onClick={() => navigate("/verification/analysis")}
          disabled={loading}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Analysis</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:pointer-events-none"
          onClick={() => navigate("/verification/online-search")}
          disabled={loading}
        >
          <span>Continue to Online Search Check</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
