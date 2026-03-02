import { useState } from "react";
import { messenger } from "../lib/messaging";
import type { AiAction } from "../lib/types";
import { useMeetingStore } from "../stores/meetingStore";

const ACTION_LABELS: Record<AiAction, string> = {
	recap: "Recap",
	assist: "Assist",
	question: "Question",
	action: "Action",
};

export function useAiAction() {
	const [isLoading, setIsLoading] = useState(false);

	const executeAction = async (action: AiAction) => {
		const store = useMeetingStore.getState();
		store.addChatMessage({ role: "user", content: ACTION_LABELS[action] });
		setIsLoading(true);
		try {
			const response = await messenger.sendMessage("ai:request", {
				action,
				utterances: store.utterances,
			});
			useMeetingStore
				.getState()
				.addChatMessage({ role: "assistant", content: response.content });
		} catch {
			useMeetingStore.getState().addChatMessage({
				role: "assistant",
				content: "Failed to get AI response. Please try again.",
			});
		} finally {
			setIsLoading(false);
		}
	};

	return { executeAction, isLoading };
}
