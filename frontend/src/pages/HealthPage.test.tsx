import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import HealthPage from "./HealthPage";
import * as api from "../services/api";
import { HealthResponse } from "../types/health";

vi.mock("../services/api");

describe("HealthPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders frontend online and shows checking state initially", () => {
    vi.mocked(api.fetchHealth).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<HealthPage />);

    expect(screen.getByRole("heading", { name: "System health" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Frontend" })).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
  });

  it("renders healthy dependencies when API returns ok", async () => {
    const mockHealth: HealthResponse = {
      status: "ok",
      version: "0.1.0",
      environment: "test",
      checks: {
        postgres: { status: "ok", latency_ms: 1.2 },
        redis: { status: "ok", latency_ms: 0.8 },
      },
    };

    vi.mocked(api.fetchHealth).mockResolvedValueOnce(mockHealth);
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText("All healthy")).toBeInTheDocument();
    });

    expect(screen.getByText("postgres")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
    expect(screen.getByText("Response time: 1.2 ms")).toBeInTheDocument();
  });

  it("renders error message when API call fails", async () => {
    vi.mocked(api.fetchHealth).mockRejectedValueOnce(new Error("Network failed"));
    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText("Needs attention")).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Connection issue: Network failed");
  });
});
