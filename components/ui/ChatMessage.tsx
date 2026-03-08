import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage as ChatMessageType } from "../../lib/types";

export function ChatMessage({ message }: { message: ChatMessageType }) {
	const isUser = message.role === "user";
	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
					isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
				}`}
			>
				{isUser ? (
					<div className="whitespace-pre-wrap">{message.content}</div>
				) : (
					<div className="prose prose-sm max-w-none">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{message.content}
						</ReactMarkdown>
					</div>
				)}
			</div>
		</div>
	);
}
