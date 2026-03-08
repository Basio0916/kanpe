import { useCallback, useEffect, useRef, useState } from "react";
import { messenger } from "../../lib/messaging";
import type { ChatMessage, Session } from "../../lib/types";
import { SessionChatPane } from "./components/SessionChatPane";
import { SessionTranscriptPane } from "./components/SessionTranscriptPane";

function EditableTitle({
	title,
	utterances,
	onSave,
}: {
	title: string;
	utterances: Session["utterances"];
	onSave: (newTitle: string) => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(title);
	const [isGenerating, setIsGenerating] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const handleSave = useCallback(() => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== title) {
			onSave(trimmed);
		} else {
			setDraft(title);
		}
		setIsEditing(false);
	}, [draft, title, onSave]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setDraft(title);
			setIsEditing(false);
		}
	};

	const handleGenerateTitle = async () => {
		if (utterances.length === 0) return;
		setIsGenerating(true);
		try {
			const generated = await messenger.sendMessage("session:generate-title", {
				utterances,
			});
			setDraft(generated);
			onSave(generated);
		} catch (e) {
			console.error("[kanpe] Failed to generate title:", e);
		} finally {
			setIsGenerating(false);
		}
	};

	if (isEditing) {
		return (
			<div className="flex items-center gap-1.5">
				<input
					ref={inputRef}
					type="text"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={handleSave}
					onKeyDown={handleKeyDown}
					className="text-sm font-bold text-gray-900 bg-white border border-blue-400 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 flex-1 min-w-0"
				/>
				{utterances.length > 0 && (
					<button
						type="button"
						onMouseDown={(e) => {
							e.preventDefault();
							handleGenerateTitle();
						}}
						disabled={isGenerating}
						className="shrink-0 p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
						title="AI でタイトルを生成"
					>
						{isGenerating ? (
							<svg
								width="16"
								height="16"
								viewBox="0 0 16 16"
								className="animate-spin"
								role="img"
								aria-label="Generating..."
							>
								<circle
									cx="8"
									cy="8"
									r="6"
									stroke="currentColor"
									strokeWidth="2"
									fill="none"
									strokeDasharray="28"
									strokeDashoffset="8"
								/>
							</svg>
						) : (
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
								role="img"
								aria-label="AI でタイトルを生成"
							>
								<path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2zM17 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM7 16l.75 2.25L10 19l-2.25.75L7 22l-.75-2.25L4 19l2.25-.75L7 16z" />
							</svg>
						)}
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1.5 group">
			<h1 className="text-sm font-bold text-gray-900 truncate">{title}</h1>
			<button
				type="button"
				onClick={() => setIsEditing(true)}
				className="shrink-0 p-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 rounded transition-all"
				title="タイトルを編集"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					role="img"
					aria-label="タイトルを編集"
				>
					<path d="M11.333 2A1.886 1.886 0 0 1 14 4.667L5.333 13.333 2 14l.667-3.333L11.333 2z" />
				</svg>
			</button>
		</div>
	);
}

export default function App() {
	const [session, setSession] = useState<Session | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const id = params.get("id");
		if (!id) {
			setError("No session ID provided.");
			return;
		}

		messenger.sendMessage("session:get", { id }).then((data) => {
			if (data) {
				setSession(data);
			} else {
				setError("Session not found.");
			}
		});
	}, []);

	const handleChatUpdate = (chatHistory: ChatMessage[]) => {
		if (!session) return;
		const updated = { ...session, chatHistory };
		setSession(updated);
		messenger.sendMessage("session:save", updated);
	};

	const handleTitleSave = (newTitle: string) => {
		if (!session) return;
		setSession({ ...session, title: newTitle });
		messenger.sendMessage("session:update-title", {
			id: session.id,
			title: newTitle,
		});
	};

	if (error) {
		return (
			<div className="flex items-center justify-center h-screen text-gray-500 text-sm">
				{error}
			</div>
		);
	}

	if (!session) {
		return (
			<div className="flex items-center justify-center h-screen text-gray-400 text-sm">
				Loading session...
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-white text-gray-900">
			<header className="border-b px-4 py-3">
				<EditableTitle
					title={session.title}
					utterances={session.utterances}
					onSave={handleTitleSave}
				/>
				<p className="text-xs text-gray-500 mt-0.5">
					{new Date(session.createdAt).toLocaleString()} ·{" "}
					{session.utterances.length} utterances
				</p>
			</header>
			<main className="flex flex-1 min-h-0">
				<SessionTranscriptPane utterances={session.utterances} />
				<SessionChatPane
					utterances={session.utterances}
					chatHistory={session.chatHistory}
					onChatUpdate={handleChatUpdate}
				/>
			</main>
		</div>
	);
}
