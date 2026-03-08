import type { View } from "../../lib/types";
import { useMeetingStore } from "../../stores/meetingStore";

const ALL_TABS: { id: View; label: string }[] = [
	{ id: "transcript", label: "Transcript" },
	{ id: "chat", label: "Chat" },
	{ id: "sessions", label: "Sessions" },
	{ id: "settings", label: "Settings" },
];

const NON_MEET_TABS: { id: View; label: string }[] = [
	{ id: "sessions", label: "Sessions" },
	{ id: "settings", label: "Settings" },
];

export function Header() {
	const currentView = useMeetingStore((s) => s.currentView);
	const setView = useMeetingStore((s) => s.setView);
	const isMeetingContext = useMeetingStore((s) => s.isMeetingContext);

	const tabs = isMeetingContext ? ALL_TABS : NON_MEET_TABS;

	return (
		<header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
			<div className="flex items-center justify-between mb-2">
				<h1 className="text-lg font-bold text-gray-900">Kanpe</h1>
			</div>
			<nav className="flex gap-1">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setView(tab.id)}
						className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
							currentView === tab.id
								? "bg-blue-100 text-blue-700 font-medium"
								: "text-gray-600 hover:bg-gray-100"
						}`}
					>
						{tab.label}
					</button>
				))}
			</nav>
		</header>
	);
}
