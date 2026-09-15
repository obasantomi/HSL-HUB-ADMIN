import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import AdminDashboard from "./AdminDashboard";
import "./base.css";
import "./AdminDashboard.css";
import "./portable-overrides.css";

document.documentElement.classList.add("light");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminDashboard />
    <Toaster position="bottom-right" richColors />
  </StrictMode>,
);
