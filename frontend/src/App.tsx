import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/firebase/AuthContext";
import HealthPage from "@/pages/HealthPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ReportingPage from "@/pages/ReportingPage";
import ReviewerPage from "@/pages/ReviewerPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import LandingPage from "@/pages/LandingPage";

function RouteFrame() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), location.key === "default" ? 850 : 360);
    return () => window.clearTimeout(timer);
  }, [location.key]);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/intake" element={<ReportingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reviewer" element={<ReviewerPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {loading && (
        <div className="page-loader" role="status" aria-label="Loading ShieldHer">
          <div className="loader-mark"><span>✦</span></div>
          <div className="loader-name">ShieldHer</div>
          <div className="loader-caption">A safer space, taking shape</div>
          <div className="loader-track"><span /></div>
          <div className="loader-dots"><i /><i /><i /></div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteFrame />
      </BrowserRouter>
    </AuthProvider>
  );
}
