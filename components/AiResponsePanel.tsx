import { useMeetingStore } from "../stores/meetingStore";

export function AiResponsePanel() {
	const aiResponses = useMeetingStore((s) => s.aiResponses);
	const isAiLoading = useMeetingStore((s) => s.isAiLoading);
	const latest = aiResponses[aiResponses.length - 1];

	if (isAiLoading) {
		return (
			<div className="p-4 border-t bg-gray-50">
				<div className="flex items-center gap-2 text-sm text-gray-500">
					<div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
					Thinking...
				</div>
			</div>
		);
	}

	if (!latest) return null;

	return (
		<div className="p-4 border-t bg-gray-50 overflow-y-auto max-h-64">
			<div className="text-xs font-medium text-gray-500 uppercase mb-2">
				{latest.action}
			</div>
			<div className="text-sm text-gray-800 whitespace-pre-wrap">
				{latest.content}
			</div>
		</div>
	);
}
