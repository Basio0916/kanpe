import { useSessionList } from "../hooks/useSessionList";
import { messenger } from "../lib/messaging";
import type { SessionSummary } from "../lib/types";

function SessionItem({
	session,
	onSelect,
	onDelete,
}: {
	session: SessionSummary;
	onSelect: () => void;
	onDelete: () => void;
}) {
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
		<div className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors">
			<button
				type="button"
				onClick={onSelect}
				className="flex-1 text-left min-w-0"
			>
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
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
				className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
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
	);
}

export function SessionListPanel() {
	const { sessions, isLoading, deleteSession } = useSessionList();

	const handleSelect = (id: string) => {
		messenger.sendMessage("session:open-viewer", { id });
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
				/>
			))}
		</div>
	);
}
