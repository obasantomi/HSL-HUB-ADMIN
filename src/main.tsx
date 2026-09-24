import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./AdminDashboard";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorBoundary from "./components/ErrorBoundary";
import "./base.css";
import "./AdminDashboard.css";
import "./portable-overrides.css";
import "./login.css";

document.documentElement.classList.add("light");

const queryClient = new QueryClient({
  defaultOptions: {
    // Failures surface as an error screen with a manual "Try again" instead of
    // silently re-requesting in the background.
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedAdminRoute>
                    <AdminDashboard />
                  </ProtectedAdminRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
