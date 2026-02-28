import {
	ApiError,
	callAnthropic,
	classifyApiError,
	getApiKey,
	setApiKey,
} from "../lib/anthropic";
import { messenger } from "../lib/messaging";
import {
	CHAT_SYSTEM,
	PROMPTS,
	buildChatMessages,
	formatTranscript,
	truncateTranscript,
} from "../lib/prompts";
import type { AiAction } from "../lib/types";

export default defineBackground(() => {
	console.log("[kanpe] Background service worker started");

	// Relay captions from Content Script to Side Panel
	messenger.onMessage("caption:new", ({ data }) => {
		messenger.sendMessage("caption:relay", data);
	});

	// Handle AI action requests
	messenger.onMessage("ai:request", async ({ data }) => {
		const apiKey = await getApiKey();
		if (!apiKey) {
			return {
				action: data.action,
				content: "Please set your API key in Settings.",
				timestamp: new Date().toISOString(),
			};
		}

		try {
			const truncated = truncateTranscript(data.utterances);
			const transcript = formatTranscript(truncated);
			const prompt = PROMPTS[data.action as AiAction];
			const result = await callAnthropic(apiKey, prompt.system, [
				{ role: "user", content: prompt.userTemplate(transcript) },
			]);
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
		const apiKey = await getApiKey();
		if (!apiKey) {
			return {
				action: "chat",
				content: "Please set your API key in Settings.",
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
			const result = await callAnthropic(apiKey, CHAT_SYSTEM, messages);
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
	messenger.onMessage("settings:getApiKey", async () => {
		return await getApiKey();
	});

	messenger.onMessage("settings:setApiKey", async ({ data }) => {
		await setApiKey(data);
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
