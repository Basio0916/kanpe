import { useEffect, useRef } from "react";
import { messenger } from "../lib/messaging";
import type { Session } from "../lib/types";
import { useMeetingStore } from "../stores/meetingStore";

function buildSessionTitle(meetUrl: string | null, createdAt: string): string {
	const date = new Date(createdAt);
	const dateStr = date.toLocaleDateString("en-US", {
		month: "2-digit",
		day: "2-digit",
	});
	const timeStr = date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	if (meetUrl) {
		const match = meetUrl.match(/meet\.google\.com\/(.+?)(\?|$)/);
		const code = match?.[1] ?? "meeting";
		return `Meeting ${code} - ${dateStr} ${timeStr}`;
	}
	return `Meeting - ${dateStr} ${timeStr}`;
}

function buildCurrentSession(): Session | null {
	const state = useMeetingStore.getState();
	if (!state.sessionId || !state.sessionCreatedAt) return null;
	return {
		id: state.sessionId,
		title: buildSessionTitle(state.meetUrl, state.sessionCreatedAt),
		meetUrl: state.meetUrl ?? undefined,
		createdAt: state.sessionCreatedAt,
		utterances: state.utterances,
		chatHistory: state.chatHistory,
	};
}

async function saveCurrentSession(): Promise<void> {
	const session = buildCurrentSession();
	if (session && session.utterances.length > 0) {
		await messenger.sendMessage("session:save", session);
	}
}

export function useSession(): void {
	const utterances = useMeetingStore((s) => s.utterances);
	const chatHistory = useMeetingStore((s) => s.chatHistory);
	const sessionId = useMeetingStore((s) => s.sessionId);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Auto-create session on first utterance
	useEffect(() => {
		if (utterances.length === 1 && sessionId === null) {
			const store = useMeetingStore.getState();
			const id = crypto.randomUUID();
			store.setSessionId(id);
			if (store.meetUrl) {
				// meetUrl already set, no action needed
			}
		}
	}, [utterances.length, sessionId]);

	// Debounced auto-save (5s)
	// biome-ignore lint/correctness/useExhaustiveDependencies: trigger save on data changes
	useEffect(() => {
		if (!sessionId) return;

		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			saveCurrentSession();
		}, 5000);

		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, [utterances.length, chatHistory.length, sessionId]);

	// beforeunload — final save
	useEffect(() => {
		const handleBeforeUnload = () => {
			saveCurrentSession();
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, []);

	// Listen for meet:url:relay
	useEffect(() => {
		const removeListener = messenger.onMessage("meet:url:relay", ({ data }) => {
			useMeetingStore.getState().setMeetUrl(data.url);
		});
		return removeListener;
	}, []);

	// Listen for meet:ended:relay — save and reset
	useEffect(() => {
		const removeListener = messenger.onMessage("meet:ended:relay", async () => {
			await saveCurrentSession();
			useMeetingStore.getState().reset();
		});
		return removeListener;
	}, []);
}
