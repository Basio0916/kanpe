const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

interface AnthropicRequest {
	model: string;
	max_tokens: number;
	system?: string;
	messages: { role: "user" | "assistant"; content: string }[];
}

interface AnthropicResponse {
	content: Array<{ type: "text"; text: string }>;
}

export class ApiError extends Error {
	constructor(
		public status: number,
		public body: unknown,
	) {
		super(`Anthropic API error: ${status}`);
		this.name = "ApiError";
	}
}

export async function callAnthropic(
	apiKey: string,
	system: string,
	messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
	const response = await fetch(ANTHROPIC_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-direct-browser-access": "true",
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: 2048,
			system,
			messages,
		} satisfies AnthropicRequest),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new ApiError(response.status, error);
	}

	const data: AnthropicResponse = await response.json();
	return data.content[0].text;
}

export async function getApiKey(): Promise<string | null> {
	const { apiKey } = await chrome.storage.local.get("apiKey");
	return apiKey ?? null;
}

export async function setApiKey(key: string): Promise<void> {
	await chrome.storage.local.set({ apiKey: key });
}

export function validateApiKey(key: string): boolean {
	return key.startsWith("sk-ant-");
}

export function classifyApiError(status: number, body?: unknown): string {
	switch (status) {
		case 401:
			return "API key is invalid. Please check your settings.";
		case 429:
			return "Rate limit exceeded. Please wait a moment.";
		default:
			if (status >= 500) return "AI service is temporarily unavailable.";
			// Extract Anthropic error message if available
			if (body && typeof body === "object" && "error" in body) {
				const err = (body as { error: { message?: string } }).error;
				if (err.message) return `API error: ${err.message}`;
			}
			return `API error (${status}). Check the background service worker console for details.`;
	}
}
