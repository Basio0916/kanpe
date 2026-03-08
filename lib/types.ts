export interface Utterance {
	speaker: string;
	text: string;
	time: string;
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface AiResponse {
	action: string;
	content: string;
	timestamp: string;
}

export type AiAction = "recap" | "assist" | "question" | "action";

export type View = "transcript" | "chat" | "settings" | "sessions";

export interface Session {
	id: string;
	title: string;
	meetUrl?: string;
	createdAt: string;
	utterances: Utterance[];
	chatHistory: ChatMessage[];
}

export interface SessionSummary {
	id: string;
	title: string;
	createdAt: string;
	utteranceCount: number;
	chatMessageCount: number;
}
