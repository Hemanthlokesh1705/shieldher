import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReportingPage from "./ReportingPage";
import * as api from "../services/api";
import { UploadResponse, VerificationResponse } from "../types/models";

vi.mock("../services/api");

describe("ReportingPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders header, navigation links, and initial evidence upload card", () => {
    render(
      <MemoryRouter>
        <ReportingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("ShieldHer")).toBeInTheDocument();
    expect(screen.getByText("1. Secure Evidence Intake")).toBeInTheDocument();
    expect(screen.getByText(/Supports JPEG, PNG, WebP/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Boundary Processing/i)).toBeInTheDocument();
  });

  it("uploads an image and renders QualityGatewayCard with provisional thresholds", async () => {
    const user = userEvent.setup();

    const mockUpload: UploadResponse = {
      sha256_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      storage_reference: "uploads/originals/test.jpg",
      file_format: "JPEG",
      file_size_bytes: 102400,
      mime_type: "image/jpeg",
      status: "PASS",
      quality_metrics: {
        width: 800,
        height: 600,
        total_pixels: 480000,
        aspect_ratio: 1.33,
        blur_laplacian_var: 185.4,
        brightness_mean: 122.5,
        contrast_std: 48.2,
        faces_detected: 1,
      },
      provisional_thresholds: {
        min_pixels: 10000,
        max_pixels: 50000000,
        min_sharpness_laplacian: 100,
        min_brightness: 40,
        max_brightness: 220,
        min_contrast: 30,
      },
      quality_notes: ["Image meets provisional forensic quality baseline."],
      normalized_derivative_available: true,
    };

    vi.mocked(api.uploadImage).mockResolvedValueOnce(mockUpload);
    vi.mocked(api.createCase).mockResolvedValueOnce({
      id: "case-uuid-1234",
      case_number: "SH-202610-TEST",
      user_id: "user-1",
      title: "Test Case",
      status: "OPEN",
      retention_policy: "TEMPORARY_EXPLORATORY",
      review_status: "UNREVIEWED",
      created_at: new Date().toISOString(),
      evidence_count: 1,
      evidence_items: [
        {
          id: "ev-uuid-1",
          case_id: "case-uuid-1234",
          filename_sanitized: "test.jpg",
          original_sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          mime_type: "image/jpeg",
          file_size_bytes: 102400,
          is_preserved: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          model_outputs: [],
        },
      ],
    });
    vi.mocked(api.uploadCaseEvidence).mockResolvedValueOnce({} as any);
    vi.mocked(api.getCase).mockResolvedValueOnce({
      id: "case-uuid-1234",
      case_number: "SH-202610-TEST",
      user_id: "user-1",
      title: "Test Case",
      status: "OPEN",
      retention_policy: "TEMPORARY_EXPLORATORY",
      review_status: "UNREVIEWED",
      created_at: new Date().toISOString(),
      evidence_count: 1,
      evidence_items: [
        {
          id: "ev-uuid-1",
          case_id: "case-uuid-1234",
          filename_sanitized: "test.jpg",
          original_sha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          mime_type: "image/jpeg",
          file_size_bytes: 102400,
          is_preserved: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          model_outputs: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <ReportingPage />
      </MemoryRouter>
    );

    const file = new File(["test image content"], "evidence.jpg", { type: "image/jpeg" });
    const input = document.getElementById("file-input") as HTMLInputElement;
    await user.upload(input, file);

    const submitBtn = screen.getByRole("button", { name: /Evaluate Evidence Quality Gateway/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("2. Quality Gateway Results")).toBeInTheDocument();
    });

    expect(screen.getByText("800 × 600 px")).toBeInTheDocument();
    expect(screen.getByText("185.4")).toBeInTheDocument();
    expect(screen.getByText(/Quality criteria thresholds are provisional heuristics/i)).toBeInTheDocument();
  });

  it("runs verification models and renders separate EFFORT and Smaug results", async () => {
    const user = userEvent.setup();

    const mockVerification: VerificationResponse = {
      sha256_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      processing_status: "SUCCESS",
      summary_message: "Models executed with native score semantics.",
      effort_result: {
        model_name: "EFFORT",
        checkpoint: "YZY-stack/Effort-AIGI-Detection",
        status: "COMPLETED",
        manipulation_probability: 0.88,
        predicted_label: "MANIPULATED",
        score_semantics: "P(manipulated) in [0, 1]",
        inference_duration_ms: 124,
        gradcam_available: false,
      },
      smaug_result: {
        model_name: "Smaug",
        checkpoint: "abacusai/Smaug-AI-Image-Detector",
        status: "COMPLETED",
        ai_generated_probability: 0.05,
        predicted_label: "HUMAN_CAPTURED",
        score_semantics: "Probability full image is synthetic in [0, 1]",
        inference_duration_ms: 210,
        hardware_device: "CPU",
      },
    };

    vi.mocked(api.verifyImage).mockResolvedValueOnce(mockVerification);

    const mockUpload: UploadResponse = {
      sha256_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      storage_reference: "uploads/originals/test.jpg",
      file_format: "JPEG",
      file_size_bytes: 102400,
      mime_type: "image/jpeg",
      status: "PASS",
      normalized_derivative_available: true,
    };
    vi.mocked(api.uploadImage).mockResolvedValueOnce(mockUpload);
    vi.mocked(api.createCase).mockResolvedValueOnce({ id: "case-1" } as any);
    vi.mocked(api.uploadCaseEvidence).mockResolvedValueOnce({} as any);
    vi.mocked(api.getCase).mockResolvedValueOnce({ id: "case-1", evidence_items: [] } as any);

    render(
      <MemoryRouter>
        <ReportingPage />
      </MemoryRouter>
    );

    const file = new File(["test image content"], "evidence.jpg", { type: "image/jpeg" });
    const input = document.getElementById("file-input") as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /Evaluate Evidence Quality Gateway/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Run EFFORT & Smaug Verification Pipeline/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Run EFFORT & Smaug Verification Pipeline/i }));

    await waitFor(() => {
      expect(screen.getByText("3. Pretrained Forensic Verification")).toBeInTheDocument();
    });

    expect(screen.getByText("88.0%")).toBeInTheDocument();
    expect(screen.getByText("5.0%")).toBeInTheDocument();
    expect(screen.getByText(/A full-image AI-generation score is not interchangeable with a face-swap score/i)).toBeInTheDocument();
  });
});
