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

export type View = "transcript" | "chat" | "settings";
