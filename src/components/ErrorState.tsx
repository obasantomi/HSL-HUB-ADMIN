import { CircleAlert, Compass, LogIn, RefreshCw, ServerCrash, ShieldAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { describeError, type AdminErrorKind } from "../lib/errors";

const ICONS: Record<AdminErrorKind, typeof CircleAlert> = {
  network: WifiOff,
  unauthorized: LogIn,
  forbidden: ShieldAlert,
  "not-found": Compass,
  conflict: RefreshCw,
  invalid: CircleAlert,
  server: ServerCrash,
  unknown: CircleAlert,
};

interface ErrorStateProps {
  error?: unknown;
  /** Overrides the title derived from the error. */
  title?: string;
  /** Overrides the message derived from the error. */
  message?: string;
  kind?: AdminErrorKind;
  /** Retrying is always manual — shown only when a handler is passed. */
  onRetry?: () => void;
  isRetrying?: boolean;
  actions?: ReactNode;
  variant?: "inline" | "page";
}

export default function ErrorState({
  error,
  title,
  message,
  kind,
  onRetry,
  isRetrying = false,
  actions,
  variant = "inline",
}: ErrorStateProps) {
  const info = describeError(error);
  const resolvedKind = kind ?? info.kind;
  const Icon = ICONS[resolvedKind];

  const body = (
    <div className={`admin-error admin-error--${variant}`} role="alert">
      <span className="admin-error-icon">
        <Icon size={20} />
      </span>
      {info.status && variant === "inline" && (
        <p className="eyebrow">Error {info.status}</p>
      )}
      <h2>{title ?? info.title}</h2>
      <p>{message ?? info.message}</p>
      {(onRetry || actions) && (
        <div className="admin-error-actions">
          {onRetry && (
            <button
              type="button"
              className="button button--black"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw size={14} className={isRetrying ? "admin-spin" : undefined} />
              {isRetrying ? "Retrying…" : "Try again"}
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );

  return variant === "page" ? <div className="admin-error-page">{body}</div> : body;
}
