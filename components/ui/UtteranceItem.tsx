import type { Utterance } from "../../lib/types";

export function UtteranceItem({ utterance }: { utterance: Utterance }) {
	return (
		<div className="flex gap-2 text-sm">
			<span className="text-gray-400 shrink-0 font-mono text-xs mt-0.5">
				{utterance.time}
			</span>
			<div>
				<span className="font-semibold text-gray-700">{utterance.speaker}</span>
				<span className="text-gray-600 ml-1">{utterance.text}</span>
			</div>
		</div>
	);
}
