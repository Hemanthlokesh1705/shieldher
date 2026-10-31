import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";
import { AuthProvider } from "../firebase/AuthContext";
import * as api from "../services/api";

vi.mock("../services/api");

describe("LoginPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("renders login form with email, password fields and sign in button", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Create one →/i)).toBeInTheDocument();
  });

  it("submits email and password to log in", async () => {
    const user = userEvent.setup();
    vi.mocked(api.loginUser).mockResolvedValueOnce({
      access_token: "mock-jwt-token",
      token_type: "bearer",
      expires_in_minutes: 120,
      user_id: "user-123",
      email: "test@example.com",
      role: "VICTIM",
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByPlaceholderText("you@example.com"), "test@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(api.loginUser).toHaveBeenCalledWith("test@example.com", "secret1234");
    });
  });

  it("displays error message when login fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api.loginUser).mockRejectedValueOnce(new Error("Incorrect email or password"));

    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByPlaceholderText("you@example.com"), "bad@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Incorrect email or password")).toBeInTheDocument();
    });
  });
});
