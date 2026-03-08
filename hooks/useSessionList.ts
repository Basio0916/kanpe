import { useCallback, useEffect, useState } from "react";
import { messenger } from "../lib/messaging";
import type { SessionSummary } from "../lib/types";

export function useSessionList() {
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		try {
			const list = await messenger.sendMessage("session:list", undefined);
			setSessions(list);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const deleteSession = useCallback(
		async (id: string) => {
			await messenger.sendMessage("session:delete", { id });
			await refresh();
		},
		[refresh],
	);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { sessions, isLoading, deleteSession, refresh };
}
