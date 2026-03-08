import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useAiAction } from "../hooks/useAiAction";
import { useChat } from "../hooks/useChat";
import type { AiAction, ChatMessage as ChatMessageType } from "../lib/types";

const AI_ACTIONS: { id: AiAction; label: string }[] = [
	{ id: "recap", label: "Recap" },
	{ id: "assist", label: "Assist" },
	{ id: "question", label: "Question" },
	{ id: "action", label: "Action" },
];

function ChatMessage({ message }: { message: ChatMessageType }) {
	const isUser = message.role === "user";
	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
					isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
				}`}
			>
				<div className="whitespace-pre-wrap">{message.content}</div>
			</div>
		</div>
	);
}

function ChatInput({
	onSend,
	disabled,
}: {
	onSend: (message: string) => void;
	disabled: boolean;
}) {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = () => {
		const trimmed = input.trim();
		if (!trimmed) return;
		onSend(trimmed);
		setInput("");
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="border-t p-3 flex gap-2">
			<textarea
				ref={textareaRef}
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Ask a question..."
				disabled={disabled}
				rows={1}
				className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
			/>
			<button
				type="button"
				onClick={handleSend}
				disabled={disabled || !input.trim()}
				className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				Send
			</button>
		</div>
	);
}

export function ChatPanel() {
	const { chatHistory, sendMessage, isLoading: isChatLoading } = useChat();
	const { executeAction, isLoading: isAiLoading } = useAiAction();
	const bottomRef = useRef<HTMLDivElement>(null);

	const isLoading = isChatLoading || isAiLoading;

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatHistory.length]);

	return (
		<div className="flex flex-col flex-1">
			<div className="flex-1 overflow-y-auto p-4 space-y-3">
				{chatHistory.length === 0 ? (
					<div className="flex items-center justify-center h-full text-gray-400 text-sm">
						Ask anything about the meeting...
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
