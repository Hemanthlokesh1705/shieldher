import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import {
  startVerificationJob,
  getVerificationJobStatus,
  verifyImage,
} from "../../services/api";
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
  Check,
  AlertCircle,
  Clock,
  Layers,
  Scale,
  Info,
} from "lucide-react";
import {
  VerificationResponse,
  EffortResult,
  GenDResult,
  SmaugResult,
  FSDResult,
  CategoryAgreementSummary,
  ModelRegistryItem,
  CheckpointStatus,
} from "../../types/models";

// ── Checkpoint Pipeline Definitions (10 Stages) ─────────────────────────────

interface CheckpointDef {
  key: string;
  stepNumber: number;
  name: string;
  shortDesc: string;
  category: "ingestion" | "quality" | "face" | "synthetic" | "synthesis";
}

const CHECKPOINT_STEPS: CheckpointDef[] = [
  {
    key: "image_upload",
    stepNumber: 1,
    name: "Evidence Ingestion",
    shortDesc: "Cryptographic SHA-256 fingerprint & payload reception",
    category: "ingestion",
  },
  {
    key: "image_validation",
    stepNumber: 2,
    name: "Integrity Validation",
    shortDesc: "Format validation, dimension bounds, and safety sanitization",
    category: "ingestion",
  },
  {
    key: "face_detection",
    stepNumber: 3,
    name: "Facial Landmark Mesh",
    shortDesc: "MediaPipe 468-point spatial face localization",
    category: "quality",
  },
  {
    key: "quality_assessment",
    stepNumber: 4,
    name: "Quality Gateway",
    shortDesc: "Laplacian blur, photometric brightness & contrast check",
    category: "quality",
  },
  {
    key: "effort_detection",
    stepNumber: 5,
    name: "EFFORT Detector",
    shortDesc: "CLIP ViT-L/14 with SVD Residuals (FaceForensics++)",
    category: "face",
  },
  {
    key: "gend_detection",
    stepNumber: 6,
    name: "GenD Detector",
    shortDesc: "CLIP ViT-L/14 LinearNorm benchmark generalizer (WACV '26)",
    category: "face",
  },
  {
    key: "smaug_detection",
    stepNumber: 7,
    name: "Smaug AI Detector",
    shortDesc: "EmbeddingGemma-2 multi-crop diffusion detector",
    category: "synthetic",
  },
  {
    key: "fsd_detection",
    stepNumber: 8,
    name: "FSD Residuals",
    shortDesc: "Forensic Self-Descriptions pixel error GMM (CVPR '25)",
    category: "synthetic",
  },
  {
    key: "forensic_summary",
    stepNumber: 9,
    name: "Category Synthesis",
    shortDesc: "Cross-model agreement & confidence evaluation",
    category: "synthesis",
  },
  {
    key: "final_result",
    stepNumber: 10,
    name: "Verification Sealed",
    shortDesc: "Tamper-evident forensic verification report ready",
    category: "synthesis",
  },
];

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

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);
  const [currentJobData, setCurrentJobData] = useState<VerificationResponse | null>(
    verificationData
  );

  const pollingRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Sync internal job data when verificationData changes
  useEffect(() => {
    if (verificationData && !currentJobData) {
      setCurrentJobData(verificationData);
    }
  }, [verificationData, currentJobData]);

  // Clean up polling timer on unmount
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

  // ── Polling Loop ─────────────────────────────────────────────────────────

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
          // Poll again in 800ms
          pollingRef.current = window.setTimeout(() => {
            pollJob(jobId);
          }, 800);
        }
      } catch (err: any) {
        if (!isMountedRef.current) return;
        // If polling endpoint fails, fallback to direct /verify
        console.warn("Job polling notice:", err.message);
        fallbackDirectVerify();
      }
    },
    [setVerificationData, setActiveJobId]
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
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(
          e.message ||
            "We were unable to complete the automated check at this time. You can retry or proceed to the next step."
        );
        setLoading(false);
      }
    }
  }, [selectedFile, activeCase?.id, setVerificationData, setActiveJobId]);

  // ── Initiate Job or Resume ───────────────────────────────────────────────

  const startPipeline = useCallback(async () => {
    // Check if we already have completed verification data
    if (
      verificationData &&
      (verificationData.overall_status === "COMPLETED" ||
        verificationData.verification_status === "VERIFIED")
    ) {
      setCurrentJobData(verificationData);
      setLoading(false);
      return;
    }

    // Check if an existing job ID is in sessionStorage or context
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
        // Resume polling existing job
        pollJob(existingJobId);
        return;
      } catch (_) {
        // Job expired or not found, clear
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

    // Start a new asynchronous verification job
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
        // Synchronous immediate response
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

  // ── Safeguard: Missing File ──────────────────────────────────────────────

  if (!selectedFile && !currentJobData && !activeJobId && !sessionStorage.getItem("shieldher_active_job_id")) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-10 text-center shadow-xs"
      >
        <div className="w-12 h-12 rounded-2xl bg-canvas-sand text-ink flex items-center justify-center mx-auto mb-3 shadow-2xs">
          <FileImage className="w-6 h-6 text-brand-forest" />
        </div>
        <h4 className="text-base font-bold text-ink font-heading">
          No image selected for verification
        </h4>
        <p className="text-xs text-ink-secondary mt-1 mb-5">
          Please upload the image you would like to analyze before continuing.
        </p>
        <Link
          to="/verification/upload"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-forest text-surface-pearl text-xs font-semibold hover:bg-brand-rich transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Upload Image</span>
        </Link>
      </motion.div>
    );
  }

  // ── Extract Data for Checkpoints & Cards ──────────────────────────────────

  const checkpointsMap: Record<string, CheckpointStatus | string> =
    currentJobData?.checkpoints || {};

  // Count completed checkpoints
  const completedCount = CHECKPOINT_STEPS.filter((step) => {
    const st = checkpointsMap[step.key];
    return st === "COMPLETED";
  }).length;

  const progressPercentage = Math.round((completedCount / CHECKPOINT_STEPS.length) * 100);

  const isPipelineComplete =
    completedCount === CHECKPOINT_STEPS.length ||
    currentJobData?.overall_status === "COMPLETED" ||
    currentJobData?.checkpoints?.final_result === "COMPLETED";

  // Category Models
  const effort: EffortResult | undefined =
    currentJobData?.effort_detection ||
    currentJobData?.effort_result ||
    currentJobData?.detection;
  const gend: GenDResult | undefined =
    currentJobData?.gend_detection || currentJobData?.gend_result;
  const smaug: SmaugResult | undefined =
    currentJobData?.smaug_detection || currentJobData?.smaug_result;
  const fsd: FSDResult | undefined =
    currentJobData?.fsd_detection || currentJobData?.fsd_result;

  // Category Agreements
  const faceAgreement: CategoryAgreementSummary | undefined =
    currentJobData?.category_agreement?.face_manipulation;
  const aiAgreement: CategoryAgreementSummary | undefined =
    currentJobData?.category_agreement?.ai_generation;

  // Model Registry
  const registry: Record<string, ModelRegistryItem> =
    currentJobData?.model_registry || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-5 sm:p-8 shadow-xs space-y-7"
    >
      {/* ── Header & Progress Overview ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-ink-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-brand-forest uppercase tracking-wider bg-brand-sage/40 px-2.5 py-0.5 rounded-full border border-brand-border">
              Step 4 of 9
            </span>
            <span className="text-xs text-ink-muted">·</span>
            <span className="text-xs font-semibold text-ink-secondary">
              Multi-Model Forensic Verification
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight mt-1">
            4. Automated Forensic Checkpoint Pipeline
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed max-w-2xl font-sans">
            Four independent neural and residual models assess facial boundaries,
            alignment consistency, and generative pixel noise without cloud transfer.
          </p>
        </div>

        {/* Live Status Pill & Progress Bar */}
        <div className="sm:text-right flex-shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-canvas-sand/70 border border-ink-border/80 text-xs font-semibold text-ink shadow-2xs">
            {isPipelineComplete ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shadow-xs" />
                <span className="text-ink font-bold">Verification Complete</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-brand-forest animate-pulse inline-block" />
                <span className="text-ink">
                  Running Pipeline ({completedCount}/10 completed)
                </span>
              </>
            )}
          </div>
          <div className="w-full sm:w-44 h-2 bg-canvas-subtle rounded-full overflow-hidden mt-2.5 border border-ink-border/50">
            <div
              className="h-full bg-brand-forest transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-accent-goldSoft border border-accent-gold/40 text-ink text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-gold flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-pearl border border-accent-gold/50 text-ink font-semibold hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={handleRetry}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry Pipeline</span>
          </button>
        </div>
      )}

      {/* ── Two-Column Main Layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* ── Left Column: 10-Checkpoint Stepper (4 cols) ───────────────── */}
        <div className="lg:col-span-4 bg-[#FAF9F6] rounded-2xl border border-ink-border/80 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-ink-border/60">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-forest" />
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-heading">
                  10 Animated Checkpoints
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold text-ink-muted bg-surface-pearl px-2 py-0.5 rounded border border-ink-border/60">
                {completedCount}/10
              </span>
            </div>

            <ol className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-3.5 before:w-[2px] before:bg-ink-border/50">
              {CHECKPOINT_STEPS.map((step) => {
                const status = (checkpointsMap[step.key] || "PENDING") as CheckpointStatus;
                const isStepRunning = status === "RUNNING";
                const isStepCompleted = status === "COMPLETED";
                const isStepFailed = status === "FAILED";
                const isStepSkipped = status === "SKIPPED";
                const isStepUnavailable = status === "UNAVAILABLE";

                return (
                  <li
                    key={step.key}
                    className={`relative flex items-start gap-3 transition-opacity ${
                      status === "PENDING" ? "opacity-55" : "opacity-100"
                    }`}
                  >
                    {/* Status Circle */}
                    <div className="relative z-10 flex-shrink-0">
                      {isStepCompleted ? (
                        <div className="w-7 h-7 rounded-full bg-brand-forest text-surface-pearl flex items-center justify-center shadow-2xs transition-transform duration-300">
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      ) : isStepRunning ? (
                        <div className="w-7 h-7 rounded-full bg-brand-sage/60 text-brand-forest flex items-center justify-center border-2 border-brand-forest animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : isStepFailed ? (
                        <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center border border-red-300">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      ) : isStepSkipped ? (
                        <div className="w-7 h-7 rounded-full bg-canvas-sand text-ink-muted flex items-center justify-center border border-ink-border/70 text-[10px] font-bold">
                          —
                        </div>
                      ) : isStepUnavailable ? (
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-surface-pearl border border-ink-border/80 text-ink-muted flex items-center justify-center text-[10px] font-bold font-mono">
                          {step.stepNumber}
                        </div>
                      )}
                    </div>

                    {/* Step Text Info */}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-bold leading-tight font-heading truncate ${
                            isStepCompleted
                              ? "text-ink"
                              : isStepRunning
                              ? "text-brand-forest font-bold"
                              : "text-ink-secondary"
                          }`}
                        >
                          {step.name}
                        </span>
                        {isStepRunning && (
                          <span className="text-[10px] font-bold text-brand-forest uppercase tracking-wider animate-pulse flex-shrink-0">
                            running…
                          </span>
                        )}
                        {isStepCompleted && (
                          <span className="text-[10px] font-medium text-brand-forest flex-shrink-0">
                            done
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-muted leading-tight mt-0.5 line-clamp-1">
                        {step.shortDesc}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Stepper Footer Disclaimer */}
          <div className="pt-4 mt-6 border-t border-ink-border/50 text-[10px] text-ink-muted leading-relaxed">
            <span className="font-semibold text-ink-secondary">Integrity guarantee:</span> Checkpoints update strictly upon verified backend execution. No simulated client-side timers.
          </div>
        </div>

        {/* ── Right Column: Four Model Cards & Agreement (8 cols) ───────── */}
        <div className="lg:col-span-8 space-y-6">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* CATEGORY 1: Face Manipulation (EFFORT & GenD)                     */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div className="rounded-2xl border border-ink-border/80 bg-[#FAF8F5] p-5 sm:p-6 shadow-2xs space-y-4">
            {/* Category Header & Agreement Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-ink-border/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center flex-shrink-0 border border-brand-border">
                  <Sparkles className="w-4 h-4 text-accent-gold" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block font-heading">
                    Category A · Independent Neural Face Detectors
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-ink font-heading">
                    Face Manipulation & Deepfake Assessment
                  </h3>
                </div>
              </div>

              {/* Agreement Status Badge */}
              <CategoryAgreementBadge agreement={faceAgreement} />
            </div>

            {/* Agreement Narrative Summary */}
            {faceAgreement && (
              <div className="p-3.5 rounded-xl bg-surface-pearl border border-ink-border/60 text-xs text-ink-primary leading-relaxed">
                <p className="font-medium">{faceAgreement.summary}</p>
                <p className="text-[11px] text-ink-secondary mt-1">{faceAgreement.details}</p>
              </div>
            )}

            {/* Two Models Grid: Model 1 (EFFORT) & Model 2 (GenD) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* ── Model 1: EFFORT ───────────────────────────────────────── */}
              <div className="bg-surface-pearl rounded-xl border border-ink-border/80 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-ink-muted uppercase block">
                      Model 1 · ICML 2025
                    </span>
                    <h4 className="text-xs font-bold text-ink font-heading">
                      EFFORT-AIGI Detector
                    </h4>
                  </div>
                  <ModelStatusBadge status={effort?.status || (checkpointsMap["effort_detection"] as string)} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-secondary">Manipulation Likelihood</span>
                    <span className="font-mono font-bold text-ink">
                      {effort && effort.manipulation_score !== undefined
                        ? `${(effort.manipulation_score * 100).toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-canvas-sand rounded-full overflow-hidden border border-ink-border/50">
                    <div
                      className={`h-full transition-all duration-500 ${
                        (effort?.manipulation_score ?? 0) >= 0.5
                          ? "bg-amber-600"
                          : "bg-emerald-600"
                      }`}
                      style={{
                        width: `${Math.min(
                          Math.max((effort?.manipulation_score ?? 0) * 100, 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-ink-border/50 text-[11px] text-ink-secondary leading-tight space-y-1">
                  <div>
                    <strong className="text-ink-primary font-medium">Architecture:</strong> CLIP ViT-L/14 + SVD Residuals
                  </div>
                  <div>
                    <strong className="text-ink-primary font-medium">Trained on:</strong> FaceForensics++ deepfake corpus
                  </div>
                  {effort?.inference_duration_ms !== undefined && (
                    <div className="text-[10px] font-mono text-ink-muted">
                      Latency: {effort.inference_duration_ms.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>

              {/* ── Model 2: GenD ─────────────────────────────────────────── */}
              <div className="bg-surface-pearl rounded-xl border border-ink-border/80 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-ink-muted uppercase block">
                      Model 2 · WACV 2026
                    </span>
                    <h4 className="text-xs font-bold text-ink font-heading">
                      GenD Generalizing Detector
                    </h4>
                  </div>
                  <ModelStatusBadge status={gend?.status || (checkpointsMap["gend_detection"] as string)} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-secondary">Deepfake Likelihood</span>
                    <span className="font-mono font-bold text-ink">
                      {gend && (gend.fake_score !== undefined || gend.class_scores)
                        ? `${(
                            (gend.fake_score ??
                              gend.class_scores?.manipulated ??
                              0) * 100
                          ).toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-canvas-sand rounded-full overflow-hidden border border-ink-border/50">
                    <div
                      className={`h-full transition-all duration-500 ${
                        (gend?.fake_score ?? 0) >= 0.5
                          ? "bg-amber-600"
                          : "bg-emerald-600"
                      }`}
                      style={{
                        width: `${Math.min(
                          Math.max(
                            (gend?.fake_score ??
                              gend?.class_scores?.manipulated ??
                              0) * 100,
                            0
                          ),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-ink-border/50 text-[11px] text-ink-secondary leading-tight space-y-1">
                  <div>
                    <strong className="text-ink-primary font-medium">Architecture:</strong> CLIP ViT-L/14 LinearNorm
                  </div>
                  <div>
                    <strong className="text-ink-primary font-medium">Classification:</strong>{" "}
                    <span className="font-semibold uppercase text-ink">
                      {gend?.predicted_class || "Evaluating"}
                    </span>
                  </div>
                  {gend?.inference_duration_ms !== undefined && (
                    <div className="text-[10px] font-mono text-ink-muted">
                      Latency: {gend.inference_duration_ms.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* CATEGORY 2: Full-Image AI Generation (Smaug & FSD)                */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div className="rounded-2xl border border-ink-border/80 bg-[#FAF8F5] p-5 sm:p-6 shadow-2xs space-y-4">
            {/* Category Header & Agreement Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-ink-border/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center flex-shrink-0 border border-brand-border">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block font-heading">
                    Category B · Generative AI Residual Detectors
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-ink font-heading">
                    Full-Image AI Synthesis & Generator Fingerprints
                  </h3>
                </div>
              </div>

              {/* Agreement Status Badge */}
              <CategoryAgreementBadge agreement={aiAgreement} />
            </div>

            {/* Agreement Narrative Summary */}
            {aiAgreement && (
              <div className="p-3.5 rounded-xl bg-surface-pearl border border-ink-border/60 text-xs text-ink-primary leading-relaxed">
                <p className="font-medium">{aiAgreement.summary}</p>
                <p className="text-[11px] text-ink-secondary mt-1">{aiAgreement.details}</p>
              </div>
            )}

            {/* Two Models Grid: Model 3 (Smaug) & Model 4 (FSD) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* ── Model 3: Smaug ───────────────────────────────────────── */}
              <div className="bg-surface-pearl rounded-xl border border-ink-border/80 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-ink-muted uppercase block">
                      Model 3 · Abacus AI
                    </span>
                    <h4 className="text-xs font-bold text-ink font-heading">
                      Smaug AI Detector
                    </h4>
                  </div>
                  <ModelStatusBadge status={smaug?.status || (checkpointsMap["smaug_detection"] as string)} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-secondary">AI Generation Probability</span>
                    <span className="font-mono font-bold text-ink">
                      {smaug && smaug.ai_generation_score !== undefined
                        ? `${(smaug.ai_generation_score * 100).toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-canvas-sand rounded-full overflow-hidden border border-ink-border/50">
                    <div
                      className={`h-full transition-all duration-500 ${
                        (smaug?.ai_generation_score ?? 0) >= 0.5
                          ? "bg-amber-600"
                          : "bg-emerald-600"
                      }`}
                      style={{
                        width: `${Math.min(
                          Math.max((smaug?.ai_generation_score ?? 0) * 100, 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-ink-border/50 text-[11px] text-ink-secondary leading-tight space-y-1">
                  <div>
                    <strong className="text-ink-primary font-medium">Architecture:</strong> EmbeddingGemma-2 (439M)
                  </div>
                  <div>
                    <strong className="text-ink-primary font-medium">Resolution:</strong> Native Multi-Crop (3 crops)
                  </div>
                  {smaug?.inference_duration_ms !== undefined && (
                    <div className="text-[10px] font-mono text-ink-muted">
                      Latency: {smaug.inference_duration_ms.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>

              {/* ── Model 4: FSD ─────────────────────────────────────────── */}
              <div className="bg-surface-pearl rounded-xl border border-ink-border/80 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-ink-muted uppercase block">
                      Model 4 · CVPR 2025
                    </span>
                    <h4 className="text-xs font-bold text-ink font-heading">
                      FSD Residual Detector
                    </h4>
                  </div>
                  <ModelStatusBadge status={fsd?.status || (checkpointsMap["fsd_detection"] as string)} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-secondary">Native FRE Z-Score</span>
                    <span className="font-mono font-bold text-ink">
                      {fsd && fsd.native_z_score !== undefined
                        ? fsd.native_z_score.toFixed(3)
                        : "—"}
                    </span>
                  </div>
                  <div className="text-[10px] text-ink-muted flex items-center justify-between">
                    <span>Threshold: -2.000</span>
                    <span>
                      {fsd?.model_derived_decision === "AI_GENERATED"
                        ? "Below Threshold (Synthetic)"
                        : "Above Threshold (Authentic)"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-ink-border/50 text-[11px] text-ink-secondary leading-tight space-y-1">
                  <div>
                    <strong className="text-ink-primary font-medium">Method:</strong> Forensic Self-Descriptions FRE + GMM
                  </div>
                  <div className="text-[10px] text-ink-muted bg-canvas-sand/60 px-2 py-0.5 rounded border border-ink-border/50 inline-block">
                    Research License (CC BY-NC-SA 4.0)
                  </div>
                  {fsd?.inference_duration_ms !== undefined && (
                    <div className="text-[10px] font-mono text-ink-muted">
                      Latency: {fsd.inference_duration_ms.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* Expandable Technical Model Specifications & Audit Log             */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <div className="border border-ink-border/80 rounded-2xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowTechDetails((v) => !v)}
              className="w-full flex items-center justify-between p-4 bg-[#FAF9F6] hover:bg-canvas-subtle text-xs font-bold text-ink transition-colors font-heading"
            >
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-brand-forest" />
                <span>Technical Model Registry & Verification Metrics</span>
              </div>
              {showTechDetails ? (
                <ChevronDown className="w-4 h-4 text-ink-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              )}
            </button>

            {showTechDetails && (
              <div className="p-4 sm:p-5 bg-surface-pearl text-xs space-y-4 border-t border-ink-border/60">
                {/* Registry Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-ink-border text-ink-muted uppercase font-mono">
                        <th className="py-2 pr-3">Model</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Checkpoint ID</th>
                        <th className="py-2 pr-3">State</th>
                        <th className="py-2">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-border/40 font-mono">
                      {Object.entries(registry).map(([key, item]) => (
                        <tr key={key}>
                          <td className="py-2 pr-3 font-bold text-ink">
                            {item.model_name || key.toUpperCase()}
                          </td>
                          <td className="py-2 pr-3 text-ink-secondary">
                            {item.category}
                          </td>
                          <td className="py-2 pr-3 text-ink-muted truncate max-w-[150px]">
                            {item.checkpoint_identifier}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                item.execution_state === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.execution_state === "RUNNING"
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {item.execution_state}
                            </span>
                          </td>
                          <td className="py-2 text-ink">
                            {item.execution_duration_ms
                              ? `${item.execution_duration_ms.toFixed(0)}ms`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[11px] text-ink-secondary leading-relaxed bg-[#FAF9F6] p-3 rounded-xl border border-ink-border/50">
                  <strong className="text-ink font-semibold">Verification Methodology:</strong> Models evaluate evidence independently without blind averaging. Face manipulation detectors (EFFORT, GenD) examine boundary artifacts and identity consistency. Synthetic image detectors (Smaug, FSD) analyze full-frame generator frequency residuals.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Navigation Action Buttons ────────────────────────────────────── */}
      <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          onClick={() => navigate("/verification/quality")}
          disabled={loading}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Quality Gateway</span>
        </button>

        <div className="flex items-center gap-2">
          {isPipelineComplete && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-ink-border/70 bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors"
              onClick={handleRetry}
              title="Run inference again"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
              <span>Re-run Checks</span>
            </button>
          )}

          <button
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => navigate("/verification/forensics")}
            disabled={loading || !currentJobData}
          >
            <span>Continue to Forensic Findings</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Reusable Component: Model Status Badge ───────────────────────────────────

function ModelStatusBadge({ status }: { status?: string }) {
  if (!status || status === "QUEUED" || status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-canvas-sand text-ink-muted border border-ink-border/60">
        <Clock className="w-2.5 h-2.5" />
        <span>Queued</span>
      </span>
    );
  }

  if (status === "RUNNING") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
        <Loader2 className="w-2.5 h-2.5 animate-spin text-teal-700" />
        <span>Evaluating…</span>
      </span>
    );
  }

  if (status === "COMPLETED" || status === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
        <span>Completed</span>
      </span>
    );
  }

  if (status === "SKIPPED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <span>Skipped</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
      <AlertTriangle className="w-2.5 h-2.5" />
      <span>{status}</span>
    </span>
  );
}

// ── Reusable Component: Category Agreement Badge ────────────────────────────

function CategoryAgreementBadge({
  agreement,
}: {
  agreement?: CategoryAgreementSummary;
}) {
  if (!agreement) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-canvas-sand text-ink-muted border border-ink-border/60">
        <Clock className="w-3 h-3" />
        <span>Evaluating Agreement…</span>
      </span>
    );
  }

  const status = agreement.status;

  if (status === "MODEL_AGREEMENT") {
    return (
      <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
        <span>Models In Agreement</span>
      </span>
    );
  }

  if (status === "POSSIBLE_MANIPULATION") {
    return (
      <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
        <span>Possible Alteration Detected</span>
      </span>
    );
  }

  if (status === "MODEL_DISAGREEMENT") {
    return (
      <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-orange-50 text-orange-900 border border-orange-300">
        <Scale className="w-3.5 h-3.5 text-orange-700" />
        <span>Model Divergence</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
      <Info className="w-3.5 h-3.5 text-slate-600" />
      <span>{status || "Inconclusive"}</span>
    </span>
  );
}
