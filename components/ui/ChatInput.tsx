import { type KeyboardEvent, useRef, useState } from "react";

export function ChatInput({
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
