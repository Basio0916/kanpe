import { useEffect } from "react";
import { ChatPanel } from "../../components/ChatPanel";
import { SessionListPanel } from "../../components/SessionListPanel";
import { SettingsPanel } from "../../components/SettingsPanel";
import { TranscriptPanel } from "../../components/TranscriptPanel";
import { Header } from "../../components/ui/Header";
import { useSession } from "../../hooks/useSession";
import { useTranscript } from "../../hooks/useTranscript";
import { messenger } from "../../lib/messaging";
import { useMeetingStore } from "../../stores/meetingStore";

export default function App() {
	const currentView = useMeetingStore((s) => s.currentView);

	// Initialize transcript listener
	useTranscript();

	// Initialize session lifecycle (must be called only once)
	useSession();

	// Initialize meeting context from background
	useEffect(() => {
		messenger.sendMessage("sidepanel:init", undefined).then(({ isMeeting }) => {
			const store = useMeetingStore.getState();
			store.setMeetingContext(isMeeting);
			if (!isMeeting) {
				store.setView("sessions");
			}
		});

		return messenger.onMessage("meet:context", ({ data }) => {
			const store = useMeetingStore.getState();
			store.setMeetingContext(data.isMeeting);
			if (!data.isMeeting) {
				const view = store.currentView;
				if (view === "transcript" || view === "chat") {
					store.setView("sessions");
				}
			}
		});
	}, []);

	return (
		<div className="flex flex-col h-screen bg-white text-gray-900">
			<Header />
			<main className="flex-1 min-h-0 overflow-y-auto">
				{currentView === "transcript" && <TranscriptPanel />}
				{currentView === "chat" && <ChatPanel />}
				{currentView === "sessions" && <SessionListPanel />}
				{currentView === "settings" && <SettingsPanel />}
			</main>
		</div>
	);
}
