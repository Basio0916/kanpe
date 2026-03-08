import { messenger } from "../lib/messaging";
import {
	CHAT_SYSTEM,
	PROMPTS,
	buildChatMessages,
	formatTranscript,
	truncateTranscript,
} from "../lib/prompts";
import {
	getProviderSettings,
	setProviderSettings,
} from "../lib/provider-settings";
import { ApiError, classifyApiError, getProvider } from "../lib/providers";
import type { AiAction } from "../lib/types";

export default defineBackground(() => {
	console.log("[kanpe] Background service worker started");

	// Relay captions from Content Script to Side Panel
	messenger.onMessage("caption:new", ({ data }) => {
		messenger.sendMessage("caption:relay", data);
	});

	// Handle AI action requests
	messenger.onMessage("ai:request", async ({ data }) => {
		const settings = await getProviderSettings();
		const provider = getProvider(settings.activeProvider);
		const config = settings.configs[settings.activeProvider];

		const validationError = provider.validateConfig(config);
		if (validationError) {
			return {
				action: data.action,
				content: validationError,
				timestamp: new Date().toISOString(),
			};
		}

		try {
			const truncated = truncateTranscript(data.utterances);
			const transcript = formatTranscript(truncated);
			const prompt = PROMPTS[data.action as AiAction];
			const result = await provider.call(
				prompt.system,
				[{ role: "user", content: prompt.userTemplate(transcript) }],
				config,
			);
			return {
				action: data.action,
				content: result,
				timestamp: new Date().toISOString(),
			};
		} catch (e) {
			if (e instanceof ApiError) {
				console.error("[kanpe] API error", e.status, JSON.stringify(e.body));
			} else {
				console.error("[kanpe] Unexpected error", e);
			}
			const message =
				e instanceof ApiError
					? classifyApiError(e.status, e.body)
					: "Network error. Please check your connection.";
			return {
				action: data.action,
				content: message,
				timestamp: new Date().toISOString(),
			};
		}
	});

	// Handle chat messages
	messenger.onMessage("chat:send", async ({ data }) => {
		const settings = await getProviderSettings();
		const provider = getProvider(settings.activeProvider);
		const config = settings.configs[settings.activeProvider];

		const validationError = provider.validateConfig(config);
		if (validationError) {
			return {
				action: "chat",
				content: validationError,
				timestamp: new Date().toISOString(),
			};
		}

		try {
			const truncated = truncateTranscript(data.utterances);
			const transcript = formatTranscript(truncated);
			const messages = buildChatMessages(
				transcript,
				data.history,
				data.message,
			);
			const result = await provider.call(CHAT_SYSTEM, messages, config);
			return {
				action: "chat",
				content: result,
				timestamp: new Date().toISOString(),
			};
		} catch (e) {
			if (e instanceof ApiError) {
				console.error("[kanpe] API error", e.status, JSON.stringify(e.body));
			} else {
				console.error("[kanpe] Unexpected error", e);
			}
			const message =
				e instanceof ApiError
					? classifyApiError(e.status, e.body)
					: "Network error. Please check your connection.";
			return {
				action: "chat",
				content: message,
				timestamp: new Date().toISOString(),
			};
		}
	});

	// Settings handlers
	messenger.onMessage("settings:getProviderSettings", async () => {
		return await getProviderSettings();
	});

	messenger.onMessage("settings:setProviderSettings", async ({ data }) => {
		await setProviderSettings(data);
	});

	// Auto-open side panel on Google Meet tabs
	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		if (tab.url?.match(/^https:\/\/meet\.google\.com\/.+/)) {
			chrome.sidePanel.setOptions({
				tabId,
				path: "sidepanel.html",
				enabled: true,
			});
		}
	});

	// Default: disable side panel
	chrome.sidePanel.setOptions({ enabled: false });
	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
