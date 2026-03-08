import type { AiProvider, ProviderId } from "../ai-provider";
import { anthropicProvider } from "./anthropic";
import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";

const providers: Record<ProviderId, AiProvider> = {
	anthropic: anthropicProvider,
	openai: openaiProvider,
	ollama: ollamaProvider,
};

export function getProvider(id: ProviderId): AiProvider {
	return providers[id];
}

export { ApiError, classifyApiError } from "./anthropic";
