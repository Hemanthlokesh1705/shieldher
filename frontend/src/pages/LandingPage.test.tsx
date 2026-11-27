import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";

class TestIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "0px";
  readonly thresholds: number[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry],
      this,
    );
  }

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return [];
  }
}

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LandingPage", () => {
  it("introduces the product and links into existing account flows", () => {
    renderLandingPage();

    expect(
      screen.getByRole("heading", {
        name: /review image evidence.*decide what comes next/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /create/i }).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /^Sign in$/ }),
    ).toHaveAttribute("href", "/login");
  });

  it("lets visitors explore the interactive workflow preview", () => {
    renderLandingPage();

    const understandButton = screen.getByRole("button", { name: /understand/i });
    fireEvent.click(understandButton);

    expect(understandButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", { name: "See the evidence in context" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Illustrative workflow, not a live case")).toBeInTheDocument();
  });
});
