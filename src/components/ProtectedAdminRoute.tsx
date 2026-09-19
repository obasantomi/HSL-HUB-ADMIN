import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { fetchCurrentUser } from "../lib/adminApi";

export default function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const { data: currentUser, isLoading: roleLoading } = useQuery({
    queryKey: ["current-user-role"],
    queryFn: fetchCurrentUser,
    enabled: !!user,
  });

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p>Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser && currentUser.role !== "ADMIN") {
    return (
      <div className="login-page">
        <div className="login-card">
          <p>Access denied. Admin only.</p>
          <button
            className="button button--black"
            onClick={async () => { await logout(); navigate("/login"); }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
