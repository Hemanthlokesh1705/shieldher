import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReviewerPage from "./ReviewerPage";
import * as api from "../services/api";
import { CaseItem, UserProfile } from "../types/models";

vi.mock("../services/api");

describe("ReviewerPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("blocks VICTIM role with role-gate permission error", async () => {
    localStorage.setItem("shieldher_token", "fake-victim-token");
    const mockVictim: UserProfile = {
      id: "u-victim",
      email: "victim@example.com",
      full_name: "Victim User",
      role: "VICTIM",
      is_active: true,
      created_at: new Date().toISOString(),
    };
    vi.mocked(api.getCurrentUser).mockResolvedValueOnce(mockVictim);

    render(
      <MemoryRouter>
        <ReviewerPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Reviewer Portal requires EXAMINER, ADVOCATE, or ADMIN role/i)
      ).toBeInTheDocument();
    });
  });

  it("authenticates EXAMINER and renders redacted triage case list", async () => {
    const user = userEvent.setup();

    const mockExaminer: UserProfile = {
      id: "u-examiner",
      email: "examiner@forensics.org",
      full_name: "Forensic Examiner",
      role: "EXAMINER",
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const mockCases: CaseItem[] = [
      {
        id: "case-999",
        case_number: "SH-202610-A1B2C3D4",
        user_id: "u-victim-anon",
        title: "Suspected Synthetic NCII",
        incident_description: "Shared on Telegram group",
        status: "OPEN",
        retention_policy: "TEMPORARY_EXPLORATORY",
        review_status: "UNREVIEWED",
        created_at: new Date().toISOString(),
        evidence_count: 1,
        evidence_items: [],
      },
    ];

    vi.mocked(api.loginUser).mockResolvedValueOnce({
      access_token: "examiner-jwt-token",
      token_type: "bearer",
      expires_in_minutes: 60,
      user_id: "u-examiner",
      email: "examiner@forensics.org",
      role: "EXAMINER",
    });
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockExaminer);
    vi.mocked(api.listCases).mockResolvedValueOnce(mockCases);

    render(
      <MemoryRouter>
        <ReviewerPage />
      </MemoryRouter>
    );

    // Fill in login credentials
    await user.type(screen.getByPlaceholderText("examiner@forensics.org"), "examiner@forensics.org");
    await user.type(screen.getByPlaceholderText("••••••••••••"), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /Sign In to Reviewer Portal/i }));

    await waitFor(() => {
      expect(screen.getByText("Triage Case List")).toBeInTheDocument();
    });

    expect(screen.getByText("SH-202610-A1B2C3D4")).toBeInTheDocument();
    expect(screen.getByText("Suspected Synthetic NCII")).toBeInTheDocument();
    expect(screen.getByText(/PII is redacted/i)).toBeInTheDocument();
  });

  it("submits examiner adjudication and records human override", async () => {
    const user = userEvent.setup();

    localStorage.setItem("shieldher_token", "examiner-token");
    const mockExaminer: UserProfile = {
      id: "u-examiner",
      email: "examiner@forensics.org",
      full_name: "Forensic Examiner",
      role: "EXAMINER",
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const targetCase: CaseItem = {
      id: "case-999",
      case_number: "SH-202610-A1B2C3D4",
      user_id: "u-victim-anon",
      title: "Suspected Synthetic NCII",
      incident_description: "Shared on Telegram group",
      status: "OPEN",
      retention_policy: "TEMPORARY_EXPLORATORY",
      review_status: "UNREVIEWED",
      created_at: new Date().toISOString(),
      evidence_count: 1,
      evidence_items: [],
    };

    vi.mocked(api.getCurrentUser).mockResolvedValue(mockExaminer);
    vi.mocked(api.listCases).mockResolvedValueOnce([targetCase]);
    vi.mocked(api.getCase).mockResolvedValueOnce(targetCase);
    vi.mocked(api.getCaseAuditLogs).mockResolvedValueOnce([
      {
        id: "log-1",
        case_id: "case-999",
        action: "CASE_CREATED",
        created_at: new Date().toISOString(),
      },
    ]);

    const updatedCase: CaseItem = {
      ...targetCase,
      review_status: "CONFIRMED_MANIPULATION",
      examiner_notes: "Artifacts on facial contour confirm manipulation.",
    };
    vi.mocked(api.submitCaseReview).mockResolvedValueOnce(updatedCase);
    vi.mocked(api.getCaseAuditLogs).mockResolvedValueOnce([
      {
        id: "log-2",
        case_id: "case-999",
        action: "HUMAN_REVIEW_RECORDED",
        details_json: { human_override: true },
        created_at: new Date().toISOString(),
      },
      {
        id: "log-1",
        case_id: "case-999",
        action: "CASE_CREATED",
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(api.listCases).mockResolvedValueOnce([updatedCase]);

    render(
      <MemoryRouter>
        <ReviewerPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("SH-202610-A1B2C3D4")).toBeInTheDocument();
    });

    // Click case in triage list
    await user.click(screen.getByText("SH-202610-A1B2C3D4"));

    await waitFor(() => {
      expect(screen.getByText("Examiner Adjudication & Override Controls")).toBeInTheDocument();
    });

    // Enter examiner notes
    const notesInput = screen.getByPlaceholderText(/Document observations regarding facial boundary discontinuity/i);
    await user.type(notesInput, "Artifacts on facial contour confirm manipulation.");

    // Check human override checkbox
    await user.click(screen.getByRole("checkbox"));

    // Submit review
    await user.click(screen.getByRole("button", { name: /Save Examiner Adjudication/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Human forensic review and override recorded successfully/i)
      ).toBeInTheDocument();
    });
  });
});
