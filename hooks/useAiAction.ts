import { messenger } from "../lib/messaging";
import type { AiAction } from "../lib/types";
import { useMeetingStore } from "../stores/meetingStore";

export function useAiAction() {
	const isLoading = useMeetingStore((s) => s.isAiLoading);

	const executeAction = async (action: AiAction) => {
		const store = useMeetingStore.getState();
		store.setAiLoading(true);
		try {
			const response = await messenger.sendMessage("ai:request", {
				action,
				utterances: store.utterances,
			});
			store.addAiResponse({
				action,
				content: response.content,
				timestamp: response.timestamp,
			});
		} catch {
			store.addAiResponse({
				action,
				content: "Failed to get AI response. Please try again.",
				timestamp: new Date().toISOString(),
			});
		} finally {
			useMeetingStore.getState().setAiLoading(false);
		}
	};

	return { executeAction, isLoading };
}
