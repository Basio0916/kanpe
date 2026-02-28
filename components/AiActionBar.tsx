import { useAiAction } from "../hooks/useAiAction";
import type { AiAction } from "../lib/types";

const AI_ACTIONS: { id: AiAction; label: string; icon: string }[] = [
	{ id: "recap", label: "Recap", icon: "\u{1F4CB}" },
	{ id: "assist", label: "Assist", icon: "\u{1F4A1}" },
	{ id: "question", label: "Question", icon: "\u{2753}" },
	{ id: "action", label: "Action", icon: "\u{2705}" },
];

export function AiActionBar() {
	const { executeAction, isLoading } = useAiAction();

	return (
		<div className="flex gap-2 p-4 border-t">
			{AI_ACTIONS.map((action) => (
				<button
					key={action.id}
					type="button"
					onClick={() => executeAction(action.id)}
					disabled={isLoading}
					className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
				>
					<span>{action.icon}</span>
					<span>{action.label}</span>
				</button>
			))}
		</div>
	);
}
