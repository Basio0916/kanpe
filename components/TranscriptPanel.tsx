import { useEffect, useRef } from "react";
import type { Utterance } from "../lib/types";
import { useMeetingStore } from "../stores/meetingStore";

function UtteranceItem({ utterance }: { utterance: Utterance }) {
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

export function TranscriptPanel() {
	const utterances = useMeetingStore((s) => s.utterances);
	const bottomRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new utterances
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [utterances.length]);

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-2">
			{utterances.length === 0 ? (
				<div className="flex items-center justify-center h-full text-gray-400 text-sm">
					Waiting for captions...
				</div>
			) : (
				utterances.map((u) => (
					<UtteranceItem key={`${u.time}-${u.speaker}`} utterance={u} />
				))
			)}
			<div ref={bottomRef} />
		</div>
	);
}
