import { create } from "zustand";
import type {
	AiResponse,
	ChatMessage,
	Session,
	Utterance,
	View,
} from "../lib/types";

interface MeetingState {
	utterances: Utterance[];
	addUtterance: (u: Utterance) => void;

	aiResponses: AiResponse[];
	addAiResponse: (r: AiResponse) => void;

	chatHistory: ChatMessage[];
	addChatMessage: (m: ChatMessage) => void;

	isAiLoading: boolean;
	setAiLoading: (loading: boolean) => void;

	currentView: View;
	setView: (view: View) => void;

	// Meeting context
	isMeetingContext: boolean;
	setMeetingContext: (isMeeting: boolean) => void;

	// Session fields
	sessionId: string | null;
	meetUrl: string | null;
	sessionCreatedAt: string | null;

	setSessionId: (id: string) => void;
	setMeetUrl: (url: string) => void;

	reset: () => void;
}

const initialState = {
	utterances: [] as Utterance[],
	aiResponses: [] as AiResponse[],
	chatHistory: [] as ChatMessage[],
	isAiLoading: false,
	currentView: "transcript" as View,
	isMeetingContext: false,
	sessionId: null as string | null,
	meetUrl: null as string | null,
	sessionCreatedAt: null as string | null,
};

export const useMeetingStore = create<MeetingState>((set, get) => ({
	...initialState,

	addUtterance: (u) =>
		set((state) => {
			const prev = state.utterances;
			const last = prev[prev.length - 1];
			// Same speaker still talking → update text of last entry
			if (last && last.speaker === u.speaker) {
				const updated = [...prev];
				updated[updated.length - 1] = { ...last, text: u.text };
				return { utterances: updated };
			}
			// New speaker → append new entry
			return { utterances: [...prev, u] };
		}),

	addAiResponse: (r) =>
		set((state) => ({ aiResponses: [...state.aiResponses, r] })),

	addChatMessage: (m) =>
		set((state) => ({ chatHistory: [...state.chatHistory, m] })),

	setAiLoading: (loading) => set({ isAiLoading: loading }),

	setView: (view) => set({ currentView: view }),

	setMeetingContext: (isMeeting) => set({ isMeetingContext: isMeeting }),

	setSessionId: (id) =>
		set({
			sessionId: id,
			sessionCreatedAt: new Date().toISOString(),
		}),

	setMeetUrl: (url) => set({ meetUrl: url }),

	reset: () => set(initialState),
}));
