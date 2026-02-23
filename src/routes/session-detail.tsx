import { useNavigate } from "react-router";
import { ScreenSessionDetail } from "@/components/kanpe/screen-session-detail";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";

export function SessionDetailPage() {
  const navigate = useNavigate();
  const locale = useAppStore((s) => s.locale);
  const d = t(locale);

  return (
    <ScreenSessionDetail dict={d} onBack={() => navigate("/sessions")} />
  );
}
