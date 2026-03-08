import { useEffect, useRef, useState } from "react";
import { useSessionList } from "../hooks/useSessionList";
import { messenger } from "../lib/messaging";
import type { SessionSummary } from "../lib/types";

function SessionItem({
	session,
	onSelect,
	onDelete,
	onRename,
}: {
	session: SessionSummary;
	onSelect: () => void;
	onDelete: () => void;
	onRename: (title: string) => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(session.title);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const handleSave = () => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== session.title) {
			onRename(trimmed);
		} else {
			setDraft(session.title);
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setDraft(session.title);
			setIsEditing(false);
		}
	};

	const date = new Date(session.createdAt);
	const dateStr = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const timeStr = date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	return (
		<div className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors group">
			<div className="flex-1 min-w-0">
				{isEditing ? (
					<input
						ref={inputRef}
						type="text"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={handleSave}
						onKeyDown={handleKeyDown}
						className="font-medium text-sm text-gray-900 w-full bg-white border border-blue-400 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<button type="button" onClick={onSelect} className="w-full text-left">
						<div className="font-medium text-sm text-gray-900 truncate">
							{session.title}
						</div>
						<div className="text-xs text-gray-500 mt-0.5">
							{dateStr} {timeStr}
						</div>
						<div className="text-xs text-gray-400 mt-0.5">
							{session.utteranceCount} utterances
							{session.chatMessageCount > 0 &&
								` · ${session.chatMessageCount} messages`}
						</div>
					</button>
				)}
			</div>
			<div className="shrink-0 flex items-center gap-0.5">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						setIsEditing(true);
					}}
					className="p-1.5 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 rounded transition-all"
					title="Rename session"
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
						aria-label="Rename session"
					>
						<path d="M11.333 2A1.886 1.886 0 0 1 14 4.667L5.333 13.333 2 14l.667-3.333L11.333 2z" />
					</svg>
				</button>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onDelete();
					}}
					className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
					title="Delete session"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						role="img"
						aria-label="Delete session"
					>
						<path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" />
					</svg>
				</button>
			</div>
		</div>
	);
}

export function SessionListPanel() {
	const { sessions, isLoading, deleteSession, refresh } = useSessionList();

	const handleSelect = (id: string) => {
		messenger.sendMessage("session:open-viewer", { id });
	};

	const handleRename = async (id: string, title: string) => {
		await messenger.sendMessage("session:update-title", { id, title });
		await refresh();
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-gray-400 text-sm">
				Loading sessions...
			</div>
		);
	}

	if (sessions.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-gray-400 text-sm">
				No saved sessions yet.
			</div>
		);
	}

	return (
		<div className="p-4 space-y-2">
			{sessions.map((session) => (
				<SessionItem
					key={session.id}
					session={session}
					onSelect={() => handleSelect(session.id)}
					onDelete={() => deleteSession(session.id)}
					onRename={(title) => handleRename(session.id, title)}
				/>
			))}
		</div>
	);
}
