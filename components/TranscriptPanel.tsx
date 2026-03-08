import { useEffect, useRef } from "react";
import { useMeetingStore } from "../stores/meetingStore";
import { UtteranceItem } from "./ui/UtteranceItem";

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
