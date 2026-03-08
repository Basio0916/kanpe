import { UtteranceItem } from "../../../components/ui/UtteranceItem";
import type { Utterance } from "../../../lib/types";

export function SessionTranscriptPane({
	utterances,
}: {
	utterances: Utterance[];
}) {
	return (
		<div className="w-1/2 border-r overflow-y-auto p-4 space-y-2">
			{utterances.length === 0 ? (
				<div className="flex items-center justify-center h-full text-gray-400 text-sm">
					No transcript data.
				</div>
			) : (
				utterances.map((u) => (
					<UtteranceItem key={`${u.time}-${u.speaker}`} utterance={u} />
				))
			)}
		</div>
	);
}
