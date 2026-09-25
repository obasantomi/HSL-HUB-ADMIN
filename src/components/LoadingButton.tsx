import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  /** Label shown while the request is in flight, e.g. "Publishing…". */
  loadingText?: ReactNode;
}

/** Button that locks itself and shows progress while its request is in flight. */
export default function LoadingButton({
  loading = false,
  loadingText,
  className = "",
  disabled,
  children,
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      {...rest}
      className={`${className}${loading ? " is-loading" : ""}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <LoaderCircle size={14} className="admin-spin" aria-hidden="true" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
