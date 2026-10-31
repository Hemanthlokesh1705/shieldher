import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "./RegisterPage";
import { AuthProvider } from "../firebase/AuthContext";
import * as api from "../services/api";

vi.mock("../services/api");

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("renders register form with name, email, role and password fields", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Jane Doe/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Encrypted Account" })).toBeInTheDocument();
    expect(screen.getByText(/Sign up with Google/i)).toBeInTheDocument();
  });

  it("validates password length and match before submitting", async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByPlaceholderText(/Jane Doe/i), "Test Victim");
    await user.type(screen.getByPlaceholderText("you@example.com"), "victim@example.com");
    const passwordInputs = screen.getAllByPlaceholderText("••••••••••••");
    await user.type(passwordInputs[0], "short");
    await user.type(passwordInputs[1], "short");
    await user.click(screen.getByRole("button", { name: "Create Encrypted Account" }));

    expect(screen.getByText("Password must be at least 8 characters long.")).toBeInTheDocument();
    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it("successfully registers and synchronizes with backend", async () => {
    const user = userEvent.setup();
    vi.mocked(api.registerUser).mockResolvedValueOnce({
      id: "u-123",
      email: "victim@example.com",
      full_name: "Test Victim",
      role: "VICTIM",
      is_active: true,
      created_at: new Date().toISOString(),
    });
    vi.mocked(api.loginUser).mockResolvedValueOnce({
      access_token: "jwt-token-123",
      token_type: "bearer",
      expires_in_minutes: 120,
      user_id: "u-123",
      email: "victim@example.com",
      role: "VICTIM",
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByPlaceholderText(/Jane Doe/i), "Test Victim");
    await user.type(screen.getByPlaceholderText("you@example.com"), "victim@example.com");
    const passwordInputs = screen.getAllByPlaceholderText("••••••••••••");
    await user.type(passwordInputs[0], "StrongP@ssw0rd");
    await user.type(passwordInputs[1], "StrongP@ssw0rd");
    await user.click(screen.getByRole("button", { name: "Create Encrypted Account" }));

    await waitFor(() => {
      expect(api.registerUser).toHaveBeenCalledWith(
        "victim@example.com",
        "StrongP@ssw0rd",
        "Test Victim",
        "VICTIM"
      );
    });
  });
});
