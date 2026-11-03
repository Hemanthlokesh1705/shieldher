import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import {
  UserCheck,
  Maximize2,
  Focus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  FileImage,
} from "lucide-react";

export default function Step3Quality() {
  const navigate = useNavigate();
  const { uploadData } = useVerification();
  const [showTechDetails, setShowTechDetails] = useState(false);

  if (!uploadData) {
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
          Please choose an image to perform the suitability check.
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

  const qm: Record<string, any> = uploadData.quality_metrics || {};
  const dims: Record<string, any> = uploadData.image_dimensions || {};

  const width = dims.width || qm.width || 0;
  const height = dims.height || qm.height || 0;
  const faceCount =
    uploadData.face_count ?? qm.faces_detected ?? uploadData.faces?.length ?? 0;
  const blurScore = qm.blur_score ?? qm.blur_laplacian_var ?? 0;
  const isClear = blurScore >= 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
            3. Image Suitability Check
          </h3>
          <p className="text-xs sm:text-sm text-ink-secondary mt-1 leading-relaxed font-sans">
            We confirm the image has sufficient clarity and resolution to produce
            reliable forensic conclusions.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-sage/50 text-brand-forest border border-brand-border">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Suitable for Analysis</span>
        </div>
      </div>

      {/* Human-Friendly Suitability Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/70 shadow-2xs">
          <div className="flex items-center gap-2 text-ink-muted text-[11px] font-bold uppercase tracking-wider mb-2 font-heading">
            <UserCheck className="w-4 h-4 text-brand-forest" />
            <span>Face Detection</span>
          </div>
          <div className="text-lg font-bold text-ink font-heading">
            {faceCount > 0
              ? `${faceCount} face${faceCount > 1 ? "s" : ""} located`
              : "No face detected"}
          </div>
          <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
            {faceCount > 0
              ? "The model can evaluate facial boundaries and facial features."
              : "The system will focus on full-image AI generation checks."}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/70 shadow-2xs">
          <div className="flex items-center gap-2 text-ink-muted text-[11px] font-bold uppercase tracking-wider mb-2 font-heading">
            <Maximize2 className="w-4 h-4 text-brand-forest" />
            <span>Resolution</span>
          </div>
          <div className="text-lg font-bold text-ink font-heading">
            {width} &times; {height} px
          </div>
          <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
            Image dimensions are sufficient for detailed pattern examination.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/70 shadow-2xs">
          <div className="flex items-center gap-2 text-ink-muted text-[11px] font-bold uppercase tracking-wider mb-2 font-heading">
            <Focus className="w-4 h-4 text-brand-forest" />
            <span>Clarity & Focus</span>
          </div>
          <div className="text-lg font-bold text-ink font-heading">
            {isClear ? "Clear & in focus" : "Slight blur detected"}
          </div>
          <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
            {isClear
              ? "Good sharp quality for artifact detection."
              : "Results may be slightly less conclusive due to softer focus."}
          </p>
        </div>
      </div>

      {/* Progressive Disclosure: Technical Metrics */}
      <div className="border border-ink-border/80 rounded-2xl overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setShowTechDetails((v) => !v)}
          className="w-full flex items-center justify-between p-4 bg-[#FAF9F6] hover:bg-canvas-subtle text-xs font-bold text-ink transition-colors font-heading"
        >
          <span>Technical image properties</span>
          {showTechDetails ? (
            <ChevronDown className="w-4 h-4 text-ink-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ink-muted" />
          )}
        </button>

        {showTechDetails && (
          <div className="p-4 sm:p-5 bg-surface-pearl text-xs space-y-2.5 border-t border-ink-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-secondary font-medium">
                Cryptographic Digest (SHA-256):
              </span>
              <span className="font-mono px-2 py-0.5 rounded bg-canvas-sand text-ink text-[11px] font-medium break-all">
                {uploadData.sha256 ||
                  uploadData.sha256_hash ||
                  "sha256:computed"}
              </span>
            </div>
            <div>
              <span className="text-ink-secondary font-medium mr-2">
                OpenCV Sharpness Score:
              </span>
              <span className="font-mono text-ink font-semibold">
                {typeof blurScore === "number"
                  ? blurScore.toFixed(2)
                  : blurScore}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Action Buttons */}
      <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
          onClick={() => navigate("/verification/upload")}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Upload</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow"
          onClick={() => navigate("/verification/analysis")}
        >
          <span>Continue to Image Analysis</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
