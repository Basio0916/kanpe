import { useState } from "react";
import { messenger } from "../lib/messaging";
import { useMeetingStore } from "../stores/meetingStore";

export function useChat() {
	const chatHistory = useMeetingStore((s) => s.chatHistory);
	const utterances = useMeetingStore((s) => s.utterances);
	const [isLoading, setIsLoading] = useState(false);

	const sendMessage = async (message: string) => {
		const store = useMeetingStore.getState();
		store.addChatMessage({ role: "user", content: message });
		setIsLoading(true);

		try {
			const response = await messenger.sendMessage("chat:send", {
				message,
				utterances,
				history: store.chatHistory,
			});
			useMeetingStore
				.getState()
				.addChatMessage({ role: "assistant", content: response.content });
		} catch {
			useMeetingStore.getState().addChatMessage({
				role: "assistant",
				content: "Failed to get response. Please try again.",
			});
		} finally {
			setIsLoading(false);
		}
	};

	return { chatHistory, sendMessage, isLoading };
}
