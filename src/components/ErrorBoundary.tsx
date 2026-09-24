import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorState from "./ErrorState";

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render crashes so the admin sees a clear message instead of a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Admin dashboard crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ErrorState
        variant="page"
        kind="unknown"
        title="The dashboard ran into a problem"
        message="Something unexpected broke while displaying this page. Reload to continue; if it keeps happening, contact platform support."
        actions={
          <button
            type="button"
            className="button button--black"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        }
      />
    );
  }
}
