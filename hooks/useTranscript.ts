import { useEffect } from "react";
import { messenger } from "../lib/messaging";
import { useMeetingStore } from "../stores/meetingStore";

export function useTranscript() {
	const utterances = useMeetingStore((s) => s.utterances);

	useEffect(() => {
		const removeListener = messenger.onMessage("caption:relay", ({ data }) => {
			useMeetingStore.getState().addUtterance(data);
		});

		return removeListener;
	}, []);

	return { utterances };
}
