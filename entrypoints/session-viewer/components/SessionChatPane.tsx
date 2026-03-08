import { useEffect, useRef, useState } from "react";
import { ChatInput } from "../../../components/ui/ChatInput";
import { ChatMessage } from "../../../components/ui/ChatMessage";
import { messenger } from "../../../lib/messaging";
import type {
	AiAction,
	ChatMessage as ChatMessageType,
	Utterance,
} from "../../../lib/types";

const AI_ACTIONS: { id: AiAction; label: string }[] = [
	{ id: "recap", label: "Recap" },
	{ id: "assist", label: "Assist" },
	{ id: "question", label: "Question" },
	{ id: "action", label: "Action" },
];

export function SessionChatPane({
	utterances,
	chatHistory: initialChatHistory,
	onChatUpdate,
}: {
	utterances: Utterance[];
	chatHistory: ChatMessageType[];
	onChatUpdate: (chatHistory: ChatMessageType[]) => void;
}) {
	const [chatHistory, setChatHistory] =
		useState<ChatMessageType[]>(initialChatHistory);
	const [isLoading, setIsLoading] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatHistory.length]);

	const executeAction = async (action: AiAction) => {
		const label = AI_ACTIONS.find((a) => a.id === action)?.label ?? action;
		const userMsg: ChatMessageType = { role: "user", content: label };
		const updatedWithUser = [...chatHistory, userMsg];
		setChatHistory(updatedWithUser);
		setIsLoading(true);

		try {
			const response = await messenger.sendMessage("ai:request", {
				action,
				utterances,
			});
			const assistantMsg: ChatMessageType = {
				role: "assistant",
				content: response.content,
			};
			const updatedWithAssistant = [...updatedWithUser, assistantMsg];
			setChatHistory(updatedWithAssistant);
			onChatUpdate(updatedWithAssistant);
		} catch {
			const errorMsg: ChatMessageType = {
				role: "assistant",
				content: "Failed to get AI response. Please try again.",
			};
			const updatedWithError = [...updatedWithUser, errorMsg];
			setChatHistory(updatedWithError);
			onChatUpdate(updatedWithError);
		} finally {
			setIsLoading(false);
		}
	};

	const sendMessage = async (message: string) => {
		const userMsg: ChatMessageType = { role: "user", content: message };
		const updatedWithUser = [...chatHistory, userMsg];
		setChatHistory(updatedWithUser);
		setIsLoading(true);

		try {
			const response = await messenger.sendMessage("chat:send", {
				message,
				utterances,
				history: updatedWithUser,
			});
			const assistantMsg: ChatMessageType = {
				role: "assistant",
				content: response.content,
			};
			const updatedWithAssistant = [...updatedWithUser, assistantMsg];
			setChatHistory(updatedWithAssistant);
			onChatUpdate(updatedWithAssistant);
		} catch {
			const errorMsg: ChatMessageType = {
				role: "assistant",
				content: "Failed to get response. Please try again.",
			};
			const updatedWithError = [...updatedWithUser, errorMsg];
			setChatHistory(updatedWithError);
			onChatUpdate(updatedWithError);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="w-1/2 flex flex-col">
			<div className="flex-1 overflow-y-auto p-4 space-y-3">
				{chatHistory.length === 0 ? (
					<div className="flex items-center justify-center h-full text-gray-400 text-sm">
						Ask anything about this meeting...
					</div>
				) : (
					chatHistory.map((msg, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: chat messages have no stable ID
						<ChatMessage key={i} message={msg} />
					))
				)}
				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
							<div className="flex items-center gap-2">
								<div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full" />
								Thinking...
							</div>
						</div>
					</div>
				)}
				<div ref={bottomRef} />
			</div>
			<div className="flex gap-2 px-3 pb-2">
				{AI_ACTIONS.map((action) => (
					<button
						key={action.id}
						type="button"
						onClick={() => executeAction(action.id)}
						disabled={isLoading}
						className="flex-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
					>
						{action.label}
					</button>
				))}
			</div>
			<ChatInput onSend={sendMessage} disabled={isLoading} />
		</div>
	);
}
