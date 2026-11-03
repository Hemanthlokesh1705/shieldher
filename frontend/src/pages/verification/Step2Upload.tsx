import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useVerification } from "../../context/VerificationContext";
import { uploadImage, createCase, uploadCaseEvidence } from "../../services/api";
import {
  UploadCloud,
  FileImage,
  Eye,
  EyeOff,
  Trash2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "../../lib/utils";

export default function Step2Upload() {
  const navigate = useNavigate();
  const {
    selectedFile,
    setSelectedFile,
    filePreviewUrl,
    setUploadData,
    activeCase,
    setActiveCase,
    consent,
  } = useVerification();

  const [dragActive, setDragActive] = useState(false);
  const [blurPreview, setBlurPreview] = useState(true);
  const [requestTitle, setRequestTitle] = useState(
    activeCase?.title || "Image Check - " + new Date().toLocaleDateString()
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Please choose a standard image file (JPEG, PNG, or WebP).");
      return;
    }
    const maxSizeBytes = 15 * 1024 * 1024; // 15 MB
    if (file.size > maxSizeBytes) {
      setError(
        `The chosen image is ${(file.size / (1024 * 1024)).toFixed(
          1
        )}MB. Please choose an image smaller than 15MB.`
      );
      return;
    }
    setSelectedFile(file);
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadAndProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please choose an image to check.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Upload & perform preliminary suitability check
      const uploadRes = await uploadImage(selectedFile);
      setUploadData(uploadRes);

      // 2. Attach or initialize user request docket
      let currentCase = activeCase;
      if (!currentCase) {
        currentCase = await createCase(
          requestTitle || "Private Image Assessment",
          "User-initiated private check",
          consent.retentionPolicy,
          consent.retentionPolicy === "TEMPORARY_EXPLORATORY" ? 7 : 365
        );
        setActiveCase(currentCase);
        try {
          await uploadCaseEvidence(currentCase.id, selectedFile);
        } catch (_) {}
      }

      navigate("/verification/quality");
    } catch {
      setError(
        "Could not complete the image upload. Please verify your connection or try another image."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-9 shadow-xs"
    >
      <div className="mb-7">
        <h3 className="text-xl sm:text-2xl font-bold text-ink font-heading tracking-tight">
          2. Select & Upload Image
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1.5 leading-relaxed font-sans max-w-2xl">
          Select the image you want to examine. A privacy blur is enabled by
          default on this device to protect your viewing comfort.
        </p>
      </div>

      {error && (
        <div
          className="mb-5 p-4 rounded-xl bg-accent-coralSoft border border-accent-coral/30 text-accent-coral text-xs leading-relaxed flex items-start gap-2.5"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1 font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleUploadAndProceed} className="space-y-6">
        {/* Optional Label */}
        <div>
          <label
            className="block text-xs font-bold text-ink font-heading mb-1.5"
            htmlFor="request-title"
          >
            Optional reference label
          </label>
          <input
            id="request-title"
            className="w-full max-w-lg h-11 px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted bg-surface-pearl border border-ink-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-rich focus:border-brand-rich transition-colors shadow-2xs"
            type="text"
            value={requestTitle}
            onChange={(e) => setRequestTitle(e.target.value)}
            placeholder="e.g. Image received via messaging app"
          />
          <p className="text-[11px] text-ink-muted mt-1.5">
            A private label to help you identify this check in your My Requests
            list.
          </p>
        </div>

        {/* Upload Dropzone */}
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
              dragActive
                ? "border-brand-forest bg-brand-sage/20 scale-[0.99]"
                : "border-ink-border bg-[#FAF9F6] hover:bg-[#F5F2EC] hover:border-brand-rich/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mx-auto mb-3.5 border border-brand-border shadow-2xs">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-ink font-heading">
              Drag and drop your image here
            </h4>
            <p className="text-xs text-ink-secondary mt-1 mb-2.5">
              or click to browse from your device
            </p>
            <span className="text-[11px] text-ink-muted font-medium bg-canvas-sand/60 px-2.5 py-0.5 rounded-full">
              Supports JPEG, PNG, and WebP up to 15MB
            </span>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF9F6] border border-ink-border/80 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-4 min-w-0">
              {/* Privacy Blurred Thumbnail */}
              {filePreviewUrl && (
                <div className="w-16 h-16 rounded-xl bg-ink-primary overflow-hidden relative flex-shrink-0 border border-ink-border shadow-2xs">
                  <img
                    src={filePreviewUrl}
                    alt="Privacy protected preview"
                    className={cn(
                      "w-full h-full object-cover transition-all duration-300",
                      blurPreview ? "blur-md scale-110" : "blur-0 scale-100"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setBlurPreview((v) => !v)}
                    className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/75 text-white text-[10px] hover:bg-black/90 transition-colors flex items-center gap-1 font-medium"
                    title={blurPreview ? "Unblur thumbnail" : "Blur thumbnail"}
                  >
                    {blurPreview ? (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Hide</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-brand-forest flex-shrink-0" />
                  <strong className="text-sm font-bold text-ink font-heading truncate">
                    {selectedFile.name}
                  </strong>
                </div>
                <div className="text-xs text-ink-secondary mt-1 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB &bull;{" "}
                  {selectedFile.type.replace("image/", "").toUpperCase()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Change Image
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-accent-coral hover:bg-accent-coralSoft transition-colors"
                onClick={handleClear}
                disabled={uploading}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Navigation Action Buttons */}
        <div className="pt-5 border-t border-ink-border/60 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ink-border bg-surface-pearl text-xs font-semibold text-ink-secondary hover:text-ink hover:bg-canvas-subtle transition-colors shadow-2xs"
            onClick={() => navigate("/verification/consent")}
            disabled={uploading}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Consent</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-forest hover:bg-brand-rich active:bg-brand-hover text-surface-pearl text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow disabled:opacity-50 disabled:pointer-events-none"
            disabled={!selectedFile || uploading}
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {uploading
                ? "Checking suitability…"
                : "Continue to Suitability Check"}
            </span>
            {!uploading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
