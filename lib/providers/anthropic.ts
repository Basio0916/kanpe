import type { AiProvider, ProviderConfigMap } from "../ai-provider";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface AnthropicRequest {
	model: string;
	max_tokens: number;
	system?: string;
	messages: { role: "user" | "assistant"; content: string }[];
}

interface AnthropicResponse {
	content: Array<{ type: "text"; text: string }>;
}

export const anthropicProvider: AiProvider = {
	id: "anthropic",
	displayName: "Anthropic",

	async call(system, messages, config) {
		const { apiKey, model } = config as ProviderConfigMap["anthropic"];

		const response = await fetch(ANTHROPIC_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
				"anthropic-dangerous-direct-browser-access": "true",
			},
			body: JSON.stringify({
				model,
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
	},

	validateConfig(config) {
		const { apiKey } = config as ProviderConfigMap["anthropic"];
		if (!apiKey || !apiKey.startsWith("sk-ant-")) {
			return 'API key must start with "sk-ant-".';
		}
		return null;
	},
};

export class ApiError extends Error {
	constructor(
		public status: number,
		public body: unknown,
	) {
		super(`API error: ${status}`);
		this.name = "ApiError";
	}
}

export function classifyApiError(status: number, body?: unknown): string {
	switch (status) {
		case 401:
			return "API key is invalid. Please check your settings.";
		case 429:
			return "Rate limit exceeded. Please wait a moment.";
		default:
			if (status >= 500) return "AI service is temporarily unavailable.";
			if (body && typeof body === "object" && "error" in body) {
				const err = (body as { error: { message?: string } }).error;
				if (err.message) return `API error: ${err.message}`;
			}
			return `API error (${status}). Check the background service worker console for details.`;
	}
}
