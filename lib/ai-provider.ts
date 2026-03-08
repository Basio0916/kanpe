export type ProviderId = "anthropic" | "openai" | "ollama";

export interface ProviderConfigMap {
	anthropic: { apiKey: string; model: string };
	openai: { apiKey: string; model: string; baseUrl: string };
	ollama: { model: string; baseUrl: string };
}

export interface ProviderSettings {
	activeProvider: ProviderId;
	configs: ProviderConfigMap;
}

export interface AiProvider {
	readonly id: ProviderId;
	readonly displayName: string;
	call(
		system: string,
		messages: { role: "user" | "assistant"; content: string }[],
		config: ProviderConfigMap[ProviderId],
	): Promise<string>;
	validateConfig(config: ProviderConfigMap[ProviderId]): string | null;
}
