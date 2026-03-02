import { ChatPanel } from "../../components/ChatPanel";
import { SettingsPanel } from "../../components/SettingsPanel";
import { TranscriptPanel } from "../../components/TranscriptPanel";
import { Header } from "../../components/ui/Header";
import { useTranscript } from "../../hooks/useTranscript";
import { useMeetingStore } from "../../stores/meetingStore";

export default function App() {
	const currentView = useMeetingStore((s) => s.currentView);

	// Initialize transcript listener
	useTranscript();

	return (
		<div className="flex flex-col h-screen bg-white text-gray-900">
			<Header />
			{currentView === "transcript" && <TranscriptPanel />}
			{currentView === "chat" && <ChatPanel />}
			{currentView === "settings" && <SettingsPanel />}
		</div>
	);
}
