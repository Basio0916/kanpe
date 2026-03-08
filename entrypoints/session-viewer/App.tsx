import { useEffect, useState } from "react";
import { messenger } from "../../lib/messaging";
import type { ChatMessage, Session, Utterance } from "../../lib/types";
import { SessionChatPane } from "./components/SessionChatPane";
import { SessionTranscriptPane } from "./components/SessionTranscriptPane";

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
				<h1 className="text-sm font-bold text-gray-900">{session.title}</h1>
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
