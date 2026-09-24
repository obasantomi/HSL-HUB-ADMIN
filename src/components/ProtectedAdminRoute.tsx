import { LogIn } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { fetchCurrentUser } from "../lib/adminApi";
import { describeError } from "../lib/errors";
import ErrorState from "./ErrorState";

export default function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const {
    data: currentUser,
    isLoading: roleLoading,
    error: roleError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["current-user-role"],
    queryFn: fetchCurrentUser,
    enabled: !!user,
  });

  const backToLogin = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const signInAgainButton = (
    <button type="button" className="button button--outline" onClick={backToLogin}>
      <LogIn size={14} />
      Back to login
    </button>
  );

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

  // Never render the dashboard without a confirmed admin role.
  if (roleError || !currentUser) {
    const { kind } = describeError(roleError);
    const sessionProblem = kind === "unauthorized" || kind === "forbidden" || kind === "not-found";

    return (
      <ErrorState
        variant="page"
        error={roleError}
        title={
          kind === "not-found"
            ? "Admin account not found"
            : sessionProblem
              ? undefined
              : "We couldn't verify your session"
        }
        message={
          kind === "not-found"
            ? "This sign-in isn't linked to an HSL account. Sign in with your admin account, or contact platform support."
            : undefined
        }
        // Retrying can't fix an auth problem, so only offer it for transient failures.
        onRetry={sessionProblem ? undefined : () => refetch()}
        isRetrying={isRefetching}
        actions={signInAgainButton}
      />
    );
  }

  if (currentUser.role !== "ADMIN") {
    return (
      <ErrorState
        variant="page"
        kind="forbidden"
        title="Admins only"
        message={`${currentUser.email} is signed in, but this account doesn't have admin access. Sign in with an admin account to continue.`}
        actions={signInAgainButton}
      />
    );
  }

  return <>{children}</>;
}
