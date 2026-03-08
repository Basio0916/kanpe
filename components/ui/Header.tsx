import type { View } from "../../lib/types";
import { useMeetingStore } from "../../stores/meetingStore";

const TABS: { id: View; label: string }[] = [
	{ id: "transcript", label: "Transcript" },
	{ id: "chat", label: "Chat" },
	{ id: "sessions", label: "Sessions" },
	{ id: "settings", label: "Settings" },
];

export function Header() {
	const currentView = useMeetingStore((s) => s.currentView);
	const setView = useMeetingStore((s) => s.setView);

	return (
		<header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
			<div className="flex items-center justify-between mb-2">
				<h1 className="text-lg font-bold text-gray-900">Kanpe</h1>
			</div>
			<nav className="flex gap-1">
				{TABS.map((tab) => (
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
