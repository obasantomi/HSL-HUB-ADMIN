import axios from "axios";

export type AdminErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid"
  | "server"
  | "unknown";

export interface AdminErrorInfo {
  kind: AdminErrorKind;
  title: string;
  message: string;
  status?: number;
}

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-not-found": "The email or password is incorrect.",
  "auth/wrong-password": "The email or password is incorrect.",
  "auth/user-disabled": "This account has been disabled. Contact platform support.",
  "auth/too-many-requests":
    "Too many sign-in attempts. Wait a few minutes before trying again.",
  "auth/network-request-failed":
    "We couldn't reach the sign-in service. Check your internet connection.",
};

function serverMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
}

/** First field message from a Zod `format()` payload, e.g. "Title is required". */
function firstValidationIssue(errors: unknown): string | undefined {
  if (!errors || typeof errors !== "object") return undefined;
  const own = (errors as { _errors?: unknown })._errors;
  if (Array.isArray(own) && typeof own[0] === "string") return own[0];
  for (const [key, value] of Object.entries(errors)) {
    if (key === "_errors") continue;
    const nested = firstValidationIssue(value);
    if (nested) return nested;
  }
  return undefined;
}

/** Classifies any thrown value into a clear, admin-facing error. */
export function describeError(error: unknown): AdminErrorInfo {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return {
        kind: "network",
        title: "Can't reach the server",
        message:
          "The HSL server isn't responding. Check your internet connection, or try again shortly if the server is restarting.",
      };
    }

    const status = error.response.status;
    const fromServer = serverMessage(error.response.data);

    if (status === 401) {
      return {
        kind: "unauthorized",
        status,
        title: "Your session has expired",
        message: "Sign in again to continue managing the platform.",
      };
    }
    if (status === 403) {
      return {
        kind: "forbidden",
        status,
        title: "Access denied",
        message: fromServer ?? "Your account doesn't have permission to do this.",
      };
    }
    if (status === 404) {
      return {
        kind: "not-found",
        status,
        title: "Not found",
        message:
          fromServer ?? "The record you're looking for doesn't exist or has been removed.",
      };
    }
    if (status === 409) {
      return {
        kind: "conflict",
        status,
        title: "This changed in the meantime",
        message: fromServer ?? "Refresh the page and try again.",
      };
    }
    if (status === 400 || status === 422) {
      return {
        kind: "invalid",
        status,
        title: "The request was rejected",
        message:
          firstValidationIssue(
            (error.response.data as { errors?: unknown } | undefined)?.errors,
          ) ??
          fromServer ??
          "Some of the submitted details are invalid.",
      };
    }
    if (status === 429) {
      return {
        kind: "invalid",
        status,
        title: "Too many requests",
        message: "You're doing that too quickly. Wait a moment and try again.",
      };
    }
    if (status >= 500) {
      return {
        kind: "server",
        status,
        title: "Something went wrong on our side",
        message:
          "The server hit an unexpected error. Try again in a moment; if it keeps happening, contact platform support.",
      };
    }
    return {
      kind: "unknown",
      status,
      title: "Request failed",
      message: fromServer ?? `The server responded with an error (${status}).`,
    };
  }

  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code.startsWith("auth/")) {
    return {
      kind: code === "auth/network-request-failed" ? "network" : "unauthorized",
      title: "Sign-in failed",
      message:
        FIREBASE_AUTH_MESSAGES[code] ?? "We couldn't sign you in. Please try again.",
    };
  }

  return {
    kind: "unknown",
    title: "Something went wrong",
    message:
      error instanceof Error && error.message
        ? error.message
        : "An unexpected error occurred. Please try again.",
  };
}

/** Short message for toasts after a failed action. */
export function getErrorMessage(error: unknown, fallback?: string): string {
  const info = describeError(error);
  if (info.kind === "unknown" && fallback) return fallback;
  return info.message;
}
