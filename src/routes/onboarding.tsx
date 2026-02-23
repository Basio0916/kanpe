import { useNavigate } from "react-router";
import { ScreenOnboarding } from "@/components/kanpe/screen-onboarding";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";

export function OnboardingPage() {
  const navigate = useNavigate();
  const locale = useAppStore((s) => s.locale);
  const d = t(locale);

  const handleComplete = () => {
    useAppStore.getState().setOnboardingComplete(true);
    navigate("/sessions", { replace: true });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <ScreenOnboarding dict={d} onComplete={handleComplete} />
    </div>
  );
}
