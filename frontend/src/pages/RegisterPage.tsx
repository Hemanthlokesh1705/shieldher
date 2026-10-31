import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../firebase/AuthContext";

type FirebaseError = { code?: string; message?: string };

function friendlyError(err: FirebaseError): string {
  switch (err.code) {
    case "auth/email-already-in-use":
      return "An account with this email address already exists. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/operation-not-allowed":
      return "Email/password registration is not enabled in Firebase project settings.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 8 characters with numbers and symbols.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return err.message || "Registration failed. Please try again.";
  }
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, register, loginWithGoogle } = useAuth();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("VICTIM");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register(email, password, fullName, role);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError(friendlyError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Left visual panel */}
      <div className="auth-panel-left">
        <img className="auth-panel-image" src="/images/shieldher-orbit.png" alt="" aria-hidden="true" />
        <div className="auth-brand">
          <div className="nav-logo-icon">🛡️</div>
          <span className="nav-logo-text" style={{ color: "#fff", fontSize: "1.25rem" }}>
            ShieldHer
          </span>
        </div>
        <div className="auth-panel-content">
          <h2 className="auth-panel-title">
            Your privacy and evidence integrity, guaranteed
          </h2>
          <p className="auth-panel-desc">
            Create an encrypted case vault to securely preserve digital evidence,
            track forensic AI verification, and prepare official legal reports
            for Indian law enforcement (IT Act 2000 & BNS 2023).
          </p>
          <div className="auth-trust-list">
            {[
              "End-to-end evidence encryption (AES-256-GCM)",
              "Zero raw cloud storage — local processing only",
              "Chain of custody compliant with ISO/IEC 27037",
              "24-hour statutory takedown request drafting",
            ].map((item) => (
              <div key={item} className="auth-trust-item">
                <div className="auth-trust-check">✓</div>
                {item}
              </div>
            ))}
          </div>
        </div>
        {/* Decorative background orbs */}
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
      </div>

      {/* Right form panel */}
      <div className="auth-panel-right">
        {/* Quick exit for safety */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <button
            className="nav-exit-btn"
            onClick={() => window.location.replace("https://www.google.com")}
            title="Immediately redirect to Google"
          >
            ✕ Quick Exit
          </button>
        </div>

        <div className="auth-form-box">
          {/* Header */}
          <div className="auth-form-header">
            <h1 className="auth-form-title">Create your account</h1>
            <p className="auth-form-subtitle">
              Join ShieldHer to securely verify and preserve evidence
            </p>
          </div>

          {/* Google SSO */}
          <button
            className="auth-google-btn"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            type="button"
          >
            {googleLoading ? (
              <span className="spinner spinner-green" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            Sign up with Google
          </button>

          <div className="auth-divider">
            <span>or register with email</span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div className="auth-field">
              <label className="auth-label">Full Name / Alias</label>
              <input
                className="input-clean"
                type="text"
                placeholder="Jane Doe or Anonymous Alias"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <input
                className="input-clean"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Account Role</label>
              <select
                className="select-clean"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="VICTIM">Victim / Survivor (Confidential Intake)</option>
                <option value="ADVOCATE">Legal Advocate / NGO Representative</option>
                <option value="EXAMINER">Forensic Analyst / Examiner</option>
              </select>
            </div>

            <div className="auth-field">
              <label className="auth-label">Password (min 8 characters)</label>
              <div className="auth-input-wrap">
                <input
                  className="input-clean"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input
                className="input-clean"
                type={showPass ? "text" : "password"}
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={loading || googleLoading}
              style={{ width: "100%", justifyContent: "center", padding: "0.8rem", marginTop: "0.5rem" }}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? "Creating Account…" : "Create Encrypted Account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Sign in →
            </Link>
          </p>

          <p className="auth-legal">
            Zero-knowledge architecture: ShieldHer does not sell personal information or share evidence without explicit authorization.
          </p>
        </div>

        {/* Emergency helpline */}
        <div className="auth-helpline">
          <span>🆘</span>
          <span>National Cybercrime Helpline: <strong>1930</strong> &nbsp;·&nbsp; Women's Helpline: <strong>1091</strong></span>
        </div>
      </div>
    </div>
  );
}
