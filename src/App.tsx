import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router";
import { OnboardingPage } from "./routes/onboarding";
import { SessionsPage } from "./routes/sessions";
import { SessionDetailPage } from "./routes/session-detail";
import { useAppStore } from "./stores/app-store";

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);

  // On mount, redirect to onboarding if not completed
  useEffect(() => {
    if (!onboardingComplete && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
  }, [onboardingComplete, location.pathname, navigate]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          onboardingComplete ? (
            <Navigate to="/sessions" replace />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/sessions" element={<SessionsPage />} />
      <Route path="/sessions/:id" element={<SessionDetailPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="h-screen bg-background text-foreground font-sans antialiased flex flex-col overflow-hidden">
      <AppRoutes />
    </div>
  );
}
