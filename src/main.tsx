import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminPage from "@/pages/Admin";
import Landing from "@/pages/Landing";
import ApiDocs from "@/pages/ApiDocs";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/app" element={<App />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={<Landing />} />
          <Route path="/api-docs" element={<ApiDocs />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
