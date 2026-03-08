import type { AiProvider, ProviderConfigMap } from "../ai-provider";
import { ApiError } from "./anthropic";

interface OpenAiRequest {
	model: string;
	messages: { role: "system" | "user" | "assistant"; content: string }[];
	max_tokens: number;
}

interface OpenAiResponse {
	choices: Array<{ message: { content: string } }>;
}

export const openaiProvider: AiProvider = {
	id: "openai",
	displayName: "OpenAI",

	async call(system, messages, config) {
		const { apiKey, model, baseUrl } = config as ProviderConfigMap["openai"];
		const url = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: [{ role: "system", content: system }, ...messages],
				max_tokens: 2048,
			} satisfies OpenAiRequest),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new ApiError(response.status, error);
		}

		const data: OpenAiResponse = await response.json();
		return data.choices[0].message.content;
	},

	validateConfig(config) {
		const { apiKey } = config as ProviderConfigMap["openai"];
		if (!apiKey) {
			return "API key is required.";
		}
		return null;
	},
};
