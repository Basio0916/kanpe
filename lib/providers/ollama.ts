import type { AiProvider, ProviderConfigMap } from "../ai-provider";
import { ApiError } from "./anthropic";

interface OllamaRequest {
	model: string;
	messages: { role: "system" | "user" | "assistant"; content: string }[];
	stream: false;
}

interface OllamaResponse {
	message: { content: string };
}

export const ollamaProvider: AiProvider = {
	id: "ollama",
	displayName: "Ollama",

	async call(system, messages, config) {
		const { model, baseUrl } = config as ProviderConfigMap["ollama"];
		const url = `${baseUrl.replace(/\/+$/, "")}/api/chat`;

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				messages: [{ role: "system", content: system }, ...messages],
				stream: false,
			} satisfies OllamaRequest),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new ApiError(response.status, error);
		}

		const data: OllamaResponse = await response.json();
		return data.message.content;
	},

	validateConfig(config) {
		const { model } = config as ProviderConfigMap["ollama"];
		if (!model) {
			return "Model name is required.";
		}
		return null;
	},
};
