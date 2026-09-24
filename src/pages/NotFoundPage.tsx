import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ErrorState from "../components/ErrorState";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <ErrorState
      variant="page"
      kind="not-found"
      title="Page not found"
      message={`There's no admin page at "${pathname}". It may have been moved, or the link is mistyped.`}
      actions={
        <>
          <button
            type="button"
            className="button button--black"
            onClick={() => navigate("/", { replace: true })}
          >
            <LayoutDashboard size={14} />
            Go to dashboard
          </button>
          <button
            type="button"
            className="button button--outline"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/", { replace: true })
            }
          >
            <ArrowLeft size={14} />
            Go back
          </button>
        </>
      }
    />
  );
}
