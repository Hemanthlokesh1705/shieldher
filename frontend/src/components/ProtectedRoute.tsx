/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Wraps any route that requires authentication.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../firebase/AuthContext";

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Avoid flash of redirect while Firebase resolves session
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #e2e8f0",
              borderTopColor: "#16a34a",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
            Verifying session…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
