import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ScreenSessionDetail } from "@/components/kanpe/screen-session-detail";
import { useAppStore } from "@/stores/app-store";
import { getSession, type SessionDetail } from "@/lib/tauri";
import { t } from "@/lib/i18n";

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const locale = useAppStore((s) => s.locale);
  const d = t(locale);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) {
        setSession(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const detail = await getSession(id);
        if (!cancelled) {
          setSession(detail);
        }
      } catch (error) {
        console.error("Failed to load session detail:", error);
        if (!cancelled) {
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <ScreenSessionDetail
      dict={d}
      session={session}
      loading={loading}
      onBack={() => navigate("/sessions")}
    />
  );
}
