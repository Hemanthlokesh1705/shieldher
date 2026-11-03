import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./firebase/AuthContext";
import { VerificationProvider } from "./context/VerificationContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

// Auth Pages (Calm, minimal, trauma-informed)
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

// Regular User Pages (Strictly separated from moderator functionality)
import DashboardPage from "./pages/DashboardPage"; // Home
import CasesPage from "./pages/CasesPage"; // My Requests
import CaseDetailPage from "./pages/CaseDetailPage";
import HelpPage from "./pages/HelpPage"; // Help & Safety
import SettingsPage from "./pages/SettingsPage"; // Account & Privacy

// Guided 9-Stage Verification Workflow
import VerificationLayout from "./pages/verification/VerificationLayout";
import Step1Consent from "./pages/verification/Step1Consent";
import Step2Upload from "./pages/verification/Step2Upload";
import Step3Quality from "./pages/verification/Step3Quality";
import Step4Analysis from "./pages/verification/Step4Analysis";
import Step5Forensics from "./pages/verification/Step5Forensics";
import Step6OnlineSearch from "./pages/verification/Step6OnlineSearch";
import Step7IncidentDetails from "./pages/verification/Step7IncidentDetails";
import Step8EvidenceReview from "./pages/verification/Step8EvidenceReview";
import Step9Report from "./pages/verification/Step9Report";

// Dedicated Separated Moderator / Staff Portal
import ReviewerPage from "./pages/ReviewerPage";

// System & Fallbacks
import HealthPage from "./pages/HealthPage";
import ReportingPage from "./pages/ReportingPage";
import NotFoundPage from "./pages/NotFoundPage";

/**
 * RootRouteHandler:
 * Unauthenticated visitors ALWAYS see the login screen first.
 * Authenticated users are directed directly to their private Home space.
 */
function RootRouteHandler() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-main)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }
  return user ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

function ModeratorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-main)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
          }}
        >
          Checking access…
        </div>
      </div>
    );
  }

  const isModerator = ["EXAMINER", "ADVOCATE", "ADMIN"].includes(
    user?.role || "",
  );
  if (!user || !isModerator) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <VerificationProvider>
        <BrowserRouter>
          <Routes>
            {/* First Screen: Unauthenticated visitors redirected to /login */}
            <Route path="/" element={<RootRouteHandler />} />

            {/* Authentication routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Protected Regular User Space (Clean 5-Item Navigation) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* 1. Home */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/home"
                element={<Navigate to="/dashboard" replace />}
              />

              {/* 2. Check an Image (9-Stage Guided Flow) */}
              <Route path="/verification" element={<VerificationLayout />}>
                <Route index element={<Navigate to="consent" replace />} />
                <Route path="new" element={<Navigate to="consent" replace />} />
                <Route path="consent" element={<Step1Consent />} />
                <Route path="upload" element={<Step2Upload />} />
                <Route path="quality" element={<Step3Quality />} />
                <Route path="analysis" element={<Step4Analysis />} />
                <Route path="forensics" element={<Step5Forensics />} />
                <Route path="online-search" element={<Step6OnlineSearch />} />
                <Route
                  path="incident-details"
                  element={<Step7IncidentDetails />}
                />
                <Route
                  path="evidence-review"
                  element={<Step8EvidenceReview />}
                />
                <Route path="report" element={<Step9Report />} />
              </Route>
              <Route
                path="/check"
                element={<Navigate to="/verification/consent" replace />}
              />

              {/* 3. My Requests */}
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/cases/:caseId" element={<CaseDetailPage />} />

              {/* 4. Help & Safety */}
              <Route path="/help" element={<HelpPage />} />

              {/* 5. Account & Privacy */}
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Separated Role-Gated Moderator Portal (Access restricted to EXAMINER/ADMIN) */}
            <Route
              path="/reviewer"
              element={
                <ModeratorRoute>
                  <ReviewerPage />
                </ModeratorRoute>
              }
            />
            <Route
              path="/moderator/cases"
              element={
                <ModeratorRoute>
                  <ReviewerPage />
                </ModeratorRoute>
              }
            />
            <Route
              path="/moderator/cases/:caseId"
              element={
                <ModeratorRoute>
                  <ReviewerPage />
                </ModeratorRoute>
              }
            />

            {/* Standalone diagnostics / intake (Preserved for existing test compatibility) */}
            <Route path="/health" element={<HealthPage />} />
            <Route path="/intake" element={<ReportingPage />} />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </VerificationProvider>
    </AuthProvider>
  );
}
