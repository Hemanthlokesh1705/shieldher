import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import {
  getVerificationJobStatus,
  startVerificationJob,
  verifyImage,
} from "../../services/api";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileImage,
  Loader2,
  RotateCcw,
  ScanFace,
} from "lucide-react";
import type { VerificationResponse } from "../../types/models";

export default function Step4Analysis() {
  const navigate = useNavigate();
  const {
    selectedFile,
    activeCase,
    activeJobId,
    setActiveJobId,
    verificationData,
    setVerificationData,
  } = useVerification();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [currentJobData, setCurrentJobData] =
    useState<VerificationResponse | null>(verificationData);

  const pollingRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (verificationData && !currentJobData) {
      setCurrentJobData(verificationData);
    }
  }, [verificationData, currentJobData]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollingRef.current) {
        window.clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      if (!isMountedRef.current) return;
      try {
        const statusRes = await getVerificationJobStatus(jobId);
        if (!isMountedRef.current) return;

        setCurrentJobData(statusRes);

        const isFinished =
          statusRes.overall_status === "COMPLETED" ||
          statusRes.overall_status === "FAILED" ||
          statusRes.overall_status === "QUALITY_RETRY" ||
          statusRes.checkpoints?.final_result === "COMPLETED";

        if (isFinished) {
          setLoading(false);
          setVerificationData(statusRes);
          sessionStorage.removeItem("shieldher_active_job_id");
          setActiveJobId(null);
        } else {
          pollingRef.current = window.setTimeout(() => {
            pollJob(jobId);
          }, 800);
        }
      } catch (err: any) {
        if (!isMountedRef.current) return;
        console.warn("Job polling notice:", err.message);
        fallbackDirectVerify();
      }
    },
    [setVerificationData, setActiveJobId],
  );

  const fallbackDirectVerify = useCallback(async () => {
    if (!selectedFile) return;
    try {
      const res = await verifyImage(selectedFile, activeCase?.id);
      if (isMountedRef.current) {
        setCurrentJobData(res);
        setVerificationData(res);
        setLoading(false);
        sessionStorage.removeItem("shieldher_active_job_id");
        setActiveJobId(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(
          err.message ||
            "We were unable to complete the automated check at this time. You can retry or proceed to the next step.",
        );
        setLoading(false);
      }
    }
  }, [selectedFile, activeCase?.id, setVerificationData, setActiveJobId]);

  const startPipeline = useCallback(async () => {
    if (
      verificationData &&
      (verificationData.overall_status === "COMPLETED" ||
        verificationData.verification_status === "VERIFIED")
    ) {
      setCurrentJobData(verificationData);
      setLoading(false);
      return;
    }

    const existingJobId =
      activeJobId || sessionStorage.getItem("shieldher_active_job_id");

    if (existingJobId) {
      setLoading(true);
      setError(null);
      try {
        const jobStatus = await getVerificationJobStatus(existingJobId);
        if (
          jobStatus.overall_status === "COMPLETED" ||
          jobStatus.checkpoints?.final_result === "COMPLETED"
        ) {
          setCurrentJobData(jobStatus);
          setVerificationData(jobStatus);
          setLoading(false);
          sessionStorage.removeItem("shieldher_active_job_id");
          setActiveJobId(null);
          return;
        }
        pollJob(existingJobId);
        return;
      } catch {
        sessionStorage.removeItem("shieldher_active_job_id");
        setActiveJobId(null);
      }
    }

    if (!selectedFile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newJob = await startVerificationJob(selectedFile, activeCase?.id, {
        includeEffort: true,
        includeGenD: true,
        includeSmaug: true,
        includeFSD: true,
        includeGradcam: false,
      });

      if (!isMountedRef.current) return;
      setCurrentJobData(newJob);

      if (newJob.job_id) {
        sessionStorage.setItem("shieldher_active_job_id", newJob.job_id);
        setActiveJobId(newJob.job_id);
        pollJob(newJob.job_id);
      } else {
        setVerificationData(newJob);
        setLoading(false);
      }
    } catch (err: any) {
      console.warn("Async job initiation fallback to direct:", err.message);
      fallbackDirectVerify();
    }
  }, [
    selectedFile,
    activeCase?.id,
    verificationData,
    activeJobId,
    setActiveJobId,
    setVerificationData,
    pollJob,
    fallbackDirectVerify,
  ]);

  useEffect(() => {
    startPipeline();
  }, [startPipeline]);

  const handleRetry = () => {
    sessionStorage.removeItem("shieldher_active_job_id");
    setActiveJobId(null);
    setVerificationData(null);
    setCurrentJobData(null);
    setError(null);
    startPipeline();
  };

  if (
    !selectedFile &&
    !currentJobData &&
    !activeJobId &&
    !sessionStorage.getItem("shieldher_active_job_id")
  ) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-10 text-center shadow-xs"
      >
        <div className="w-12 h-12 rounded-2xl bg-canvas-sand text-ink flex items-center justify-center mx-auto mb-3 shadow-2xs">
          <FileImage className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-ink font-heading">
          No image selected
        </h4>
        <p className="text-xs text-ink-secondary mt-1 mb-5">
          Please choose an image to perform the analysis.
        </p>
        <Link
          to="/verification/upload"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-action text-action-ink text-xs font-semibold hover:bg-action-hover transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Choose an Image</span>
        </Link>
      </motion.div>
    );
  }

  const resultData = currentJobData ?? verificationData;
  const effort =
    resultData?.effort_detection ||
    resultData?.effort_result ||
    resultData?.detection;
  const smaug = resultData?.smaug_detection || resultData?.smaug_result;
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
        <div
          className="p-4 rounded-xl bg-surface-subtle border border-ink-border text-ink text-xs flex items-center justify-between gap-4"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-pearl border border-ink-border text-ink font-semibold hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={handleRetry}
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
            This takes a few moments while our analysis models evaluate facial
            edges and pixel frequency signatures.
          </p>
        </div>
      ) : resultData ? (
        <div className="space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-surface-subtle border border-ink-border/80 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle/40 text-brand-forest flex items-center justify-center flex-shrink-0 border border-brand-border">
                  <ScanFace className="w-4 h-4" />
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
                    ? "bg-surface-subtle text-ink-secondary border border-ink-border"
                    : "bg-surface-subtle/50 text-brand-forest border border-brand-border"
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
              <strong className="text-ink-primary font-semibold">
                What was examined:
              </strong>{" "}
              Facial boundary blending, contour lighting consistency, and
              landmark alignment. Results provide probabilistic indicators,
              not legal certainty.
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-surface-subtle border border-ink-border/80 space-y-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-subtle/40 text-brand-forest flex items-center justify-center flex-shrink-0 border border-brand-border">
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
                    ? "bg-surface-subtle text-ink-secondary border border-ink-border"
                    : "bg-surface-subtle/50 text-brand-forest border border-brand-border"
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
              <strong className="text-ink-primary font-semibold">
                What was examined:
              </strong>{" "}
              Full-frame noise distribution and synthesis frequency
              fingerprints. Results help guide your next steps and evidence
              documentation.
            </div>
          </div>

          <div className="border border-ink-border/80 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowTechDetails((value) => !value)}
              className="w-full flex items-center justify-between p-4 bg-surface-subtle hover:bg-canvas-subtle text-xs font-bold text-ink transition-colors font-heading"
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action hover:bg-action-hover active:bg-action-hover text-action-ink text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:pointer-events-none"
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
