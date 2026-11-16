import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardSkeleton from "./DashboardSkeleton";

describe("DashboardSkeleton", () => {
  it("announces loading and renders placeholders for the dashboard sections", () => {
    render(<DashboardSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your dashboard",
    );
    expect(screen.getByRole("region", { name: "Loading dashboard" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("group", { name: "Loading next steps" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Loading recent requests" })).toBeInTheDocument();
  });
});
