import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router";
import { OnboardingPage } from "./routes/onboarding";
import { SessionsPage } from "./routes/sessions";
import { SessionDetailPage } from "./routes/session-detail";
import { useAppStore } from "./stores/app-store";
import { checkPermissions, onSessionCompleted } from "./lib/tauri";

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let mounted = true;
    const bootstrapOnboardingState = async () => {
      try {
        const status = await checkPermissions();
        const allGranted =
          status.microphone === "granted" &&
          status.screen_audio === "granted" &&
          status.overlay === "granted";
        useAppStore.getState().setOnboardingComplete(allGranted);
      } catch (error) {
        console.error("Failed to bootstrap onboarding state:", error);
        useAppStore.getState().setOnboardingComplete(false);
      } finally {
        if (mounted) {
          setBootstrapped(true);
        }
      }
    };
    void bootstrapOnboardingState();
    return () => {
      mounted = false;
    };
  }, []);

  // On mount, redirect to onboarding if not completed
  useEffect(() => {
    if (!bootstrapped) return;
    if (!onboardingComplete && location.pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
    }
    if (onboardingComplete && location.pathname === "/onboarding") {
      navigate("/sessions", { replace: true });
    }
  }, [bootstrapped, onboardingComplete, location.pathname, navigate]);

  useEffect(() => {
    const unlisten = onSessionCompleted((event) => {
      navigate(`/sessions/${event.sessionId}`);
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [navigate]);

  if (!bootstrapped) {
    return null;
  }

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
