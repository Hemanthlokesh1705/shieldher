import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { verifyImage } from "../../services/api";
import {
  Sparkles,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileImage,
  RotateCcw,
} from "lucide-react";

export default function Step4Analysis() {
  const navigate = useNavigate();
  const { selectedFile, activeCase, verificationData, setVerificationData } =
    useVerification();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function runVerification() {
      if (verificationData || !selectedFile) return;

      setLoading(true);
      setError(null);
      try {
        const res = await verifyImage(selectedFile, activeCase?.id);
        if (isMounted) {
          setVerificationData(res);
        }
      } catch {
        if (isMounted) {
          setError(
            "We were unable to complete the automated check at this time. You can retry or proceed to the next step."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    runVerification();
    return () => {
      isMounted = false;
    };
  }, [selectedFile, activeCase?.id, verificationData, setVerificationData]);

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
          Please choose an image to perform the analysis.
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

  const effort =
    verificationData?.effort_detection || verificationData?.effort_result;
  const smaug =
    verificationData?.smaug_detection || verificationData?.smaug_result;

  const effortScore =
    effort?.manipulation_probability ?? effort?.manipulation_score ?? 0;
  const smaugScore =
    smaug?.ai_generated_probability ?? smaug?.ai_generation_score ?? 0;

  const isEffortManipulated = effortScore >= 0.5;
  const isSmaugSynthetic = smaugScore >= 0.5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs space-y-6"
    >
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
          4. Image Analysis Results
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed font-sans">
          We examined the image for signs of facial manipulation and synthetic AI
          generation using localized forensic models.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-accent-goldSoft border border-accent-gold/40 text-ink text-xs flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-pearl border border-accent-gold/50 text-ink font-semibold hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={() => setVerificationData(null)}
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
            Checking image patterns…
          </h4>
          <p className="text-xs text-ink-secondary mt-1 max-w-sm mx-auto leading-relaxed">
            This takes a few moments while our local models evaluate facial edges
            and pixel frequency signatures.
          </p>
        </div>
      ) : verificationData ? (
        <div className="space-y-4">
          {/* Assessment 1: Face Manipulation */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center flex-shrink-0 border border-brand-border">
                  <Sparkles className="w-4 h-4 text-accent-gold" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block font-heading">
                    Assessment 1
                  </span>
                  <h4 className="text-sm font-bold text-ink font-heading">
                    Face Manipulation Assessment
                  </h4>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold ${
                  isEffortManipulated
                    ? "bg-accent-goldSoft text-accent-gold border border-accent-gold/40"
                    : "bg-brand-sage/50 text-brand-forest border border-brand-border"
                }`}
              >
                {isEffortManipulated ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Possible manipulation detected</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No strong signs detected</span>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-ink-primary leading-relaxed">
              {isEffortManipulated
                ? "Our model detected irregular edge patterns around the facial boundaries that are often associated with face-swapping or digital insertion."
                : "We did not detect strong signs of facial splicing or manipulation around the facial contours."}
            </p>

            <div className="pt-2.5 text-[11px] text-ink-secondary border-t border-ink-border/50 leading-relaxed">
              <strong className="text-ink-primary font-semibold">What was examined:</strong> Facial boundary blending, contour
              lighting consistency, and landmark alignment. Results provide
              probabilistic indicators, not legal certainty.
            </div>
          </div>

          {/* Assessment 2: AI Generation */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center flex-shrink-0 border border-brand-border">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block font-heading">
                    Assessment 2
                  </span>
                  <h4 className="text-sm font-bold text-ink font-heading">
                    AI-Generated Image Assessment
                  </h4>
                </div>
              </div>

              <div
                className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold ${
                  isSmaugSynthetic
                    ? "bg-accent-goldSoft text-accent-gold border border-accent-gold/40"
                    : "bg-brand-sage/50 text-brand-forest border border-brand-border"
                }`}
              >
                {isSmaugSynthetic ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Possible AI generation detected</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No strong signs detected</span>
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-ink-primary leading-relaxed">
              {isSmaugSynthetic
                ? "Our model detected pattern signatures commonly produced by text-to-image AI tools and diffusion generators."
                : "The overall frequency and texture distributions match characteristics typical of conventional digital photography."}
            </p>

            <div className="pt-2.5 text-[11px] text-ink-secondary border-t border-ink-border/50 leading-relaxed">
              <strong className="text-ink-primary font-semibold">What was examined:</strong> Full-frame noise distribution
              and synthesis frequency fingerprints. Results help guide your next
              steps and evidence documentation.
            </div>
          </div>

          {/* Collapsible Technical Details */}
          <div className="border border-ink-border/80 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowTechDetails((v) => !v)}
              className="w-full flex items-center justify-between p-4 bg-[#FAF9F6] hover:bg-canvas-subtle text-xs font-bold text-ink transition-colors font-heading"
            >
              <span>Technical model measurements</span>
              {showTechDetails ? (
                <ChevronDown className="w-4 h-4 text-ink-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              )}
            </button>

            {showTechDetails && (
              <div className="p-4 sm:p-5 bg-surface-pearl text-xs space-y-2 border-t border-ink-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-ink-secondary font-medium mr-2">
                      EFFORT Manipulation Probability:
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {(effortScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-secondary font-medium mr-2">
                      Smaug Synthetic Probability:
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {(smaugScore * 100).toFixed(1)}%
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
          onClick={() => navigate("/verification/quality")}
          disabled={loading}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Suitability</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:pointer-events-none"
          onClick={() => navigate("/verification/forensics")}
          disabled={loading || !verificationData}
        >
          <span>Continue to Forensic Findings</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
