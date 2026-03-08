import type { ChatMessage, Utterance } from "./types";

const SYSTEM_BASE = `You are Kanpe, an AI meeting assistant for Google Meet.
You are given a transcript of the ongoing meeting.
Respond concisely and actionably. Use the same language as the transcript.`;

export const PROMPTS = {
	recap: {
		system: `${SYSTEM_BASE}
Your task is to summarize the meeting so far.
- Highlight key topics discussed
- Note any decisions made
- Keep it concise (3-5 bullet points)`,
		userTemplate: (transcript: string) =>
			`Here is the meeting transcript so far:\n\n${transcript}\n\nPlease provide a recap.`,
	},
	assist: {
		system: `${SYSTEM_BASE}
Your task is to suggest what the user should say next.
- Consider the flow of the conversation
- Provide 2-3 concrete suggestions
- Each suggestion should be a complete sentence ready to speak`,
		userTemplate: (transcript: string) =>
			`Here is the meeting transcript so far:\n\n${transcript}\n\nWhat should I say next?`,
	},
	question: {
		system: `${SYSTEM_BASE}
Your task is to suggest relevant questions to ask.
- Identify gaps or unclear points in the discussion
- Provide 2-3 specific questions
- Questions should move the meeting forward productively`,
		userTemplate: (transcript: string) =>
			`Here is the meeting transcript so far:\n\n${transcript}\n\nWhat questions should I ask?`,
	},
	action: {
		system: `${SYSTEM_BASE}
Your task is to extract action items and decisions.
- List each action item with the responsible person (if mentioned)
- Include any deadlines mentioned
- Separate decisions from action items
- Format as a clear checklist`,
		userTemplate: (transcript: string) =>
			`Here is the meeting transcript so far:\n\n${transcript}\n\nPlease extract action items and decisions.`,
	},
} as const;

export const CHAT_SYSTEM = `${SYSTEM_BASE}
You are having a conversation with the meeting participant.
Use the provided meeting transcript as context to answer their questions.
If the question is unrelated to the meeting, still try to help but note the context.`;

export const TITLE_GENERATION = {
	system: `You are Kanpe, an AI meeting assistant.
Given a meeting transcript, generate a short, descriptive title for the meeting.
- The title should capture the main topic or purpose of the meeting
- Keep it concise: 5-10 words maximum
- Use the same language as the transcript
- Do NOT include dates, times, or meeting codes
- Return ONLY the title text, nothing else`,
	userTemplate: (transcript: string) =>
		`Here is the meeting transcript:\n\n${transcript}\n\nGenerate a concise title for this meeting.`,
};

export function formatTranscript(utterances: Utterance[]): string {
	return utterances
		.map((u) => `[${u.time}] ${u.speaker}: ${u.text}`)
		.join("\n");
}

export function truncateTranscript(
	utterances: Utterance[],
	maxCount = 200,
): Utterance[] {
	if (utterances.length <= maxCount) return utterances;
	return utterances.slice(-maxCount);
}

export function buildChatMessages(
	transcript: string,
	history: ChatMessage[],
	newMessage: string,
): { role: "user" | "assistant"; content: string }[] {
	const messages: { role: "user" | "assistant"; content: string }[] = [];

	if (history.length === 0) {
		messages.push({
			role: "user",
			content: `Meeting transcript:\n\n${transcript}\n\n---\n\n${newMessage}`,
		});
	} else {
		messages.push({
			role: "user",
			content: `Meeting transcript:\n\n${transcript}\n\n---\n\n${history[0].content}`,
		});
		for (let i = 1; i < history.length; i++) {
			messages.push({
				role: history[i].role,
				content: history[i].content,
			});
		}
		messages.push({ role: "user", content: newMessage });
	}

	return messages;
}
