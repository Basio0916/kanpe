import type { ProviderSettings } from "./ai-provider";

const STORAGE_KEY = "providerSettings";

export const DEFAULT_SETTINGS: ProviderSettings = {
	activeProvider: "anthropic",
	configs: {
		anthropic: { apiKey: "", model: "claude-haiku-4-5" },
		openai: {
			apiKey: "",
			model: "gpt-4o-mini",
			baseUrl: "https://api.openai.com",
		},
		ollama: { model: "llama3.2", baseUrl: "http://localhost:11434" },
	},
};

export async function getProviderSettings(): Promise<ProviderSettings> {
	const { [STORAGE_KEY]: settings } =
		await chrome.storage.local.get(STORAGE_KEY);

	if (settings) return settings as ProviderSettings;

	// Legacy migration: move old apiKey to new format
	const { apiKey } = await chrome.storage.local.get("apiKey");
	if (apiKey) {
		const migrated: ProviderSettings = {
			...DEFAULT_SETTINGS,
			configs: {
				...DEFAULT_SETTINGS.configs,
				anthropic: { ...DEFAULT_SETTINGS.configs.anthropic, apiKey },
			},
		};
		await chrome.storage.local.set({ [STORAGE_KEY]: migrated });
		await chrome.storage.local.remove("apiKey");
		return migrated;
	}

	return DEFAULT_SETTINGS;
}

export async function setProviderSettings(
	settings: ProviderSettings,
): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
