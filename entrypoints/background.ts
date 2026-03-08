import { messenger } from "../lib/messaging";
import {
	CHAT_SYSTEM,
	PROMPTS,
	TITLE_GENERATION,
	buildChatMessages,
	formatTranscript,
	truncateTranscript,
} from "../lib/prompts";
import {
	getProviderSettings,
	setProviderSettings,
} from "../lib/provider-settings";
import { ApiError, classifyApiError, getProvider } from "../lib/providers";
import {
	deleteSession,
	getSession,
	getSessionIndex,
	saveSession,
	updateSessionTitle,
} from "../lib/session-storage";
import type { AiAction } from "../lib/types";

export default defineBackground(() => {
	console.log("[kanpe] Background service worker started");

	// Track active Meet tabs for end detection
	const activeMeetTabs = new Set<number>();

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

	// Session handlers
	messenger.onMessage("session:list", async () => {
		return await getSessionIndex();
	});

	messenger.onMessage("session:get", async ({ data }) => {
		return await getSession(data.id);
	});

	messenger.onMessage("session:save", async ({ data }) => {
		await saveSession(data);
	});

	messenger.onMessage("session:delete", async ({ data }) => {
		await deleteSession(data.id);
	});

	messenger.onMessage("session:update-title", async ({ data }) => {
		await updateSessionTitle(data.id, data.title);
	});

	messenger.onMessage("session:generate-title", async ({ data }) => {
		const settings = await getProviderSettings();
		const provider = getProvider(settings.activeProvider);
		const config = settings.configs[settings.activeProvider];

		const validationError = provider.validateConfig(config);
		if (validationError) {
			throw new Error(validationError);
		}

		const truncated = truncateTranscript(data.utterances);
		const transcript = formatTranscript(truncated);
		const result = await provider.call(
			TITLE_GENERATION.system,
			[{ role: "user", content: TITLE_GENERATION.userTemplate(transcript) }],
			config,
		);
		return result.trim();
	});

	// Relay Meet URL from Content Script to Side Panel & track tab
	messenger.onMessage("meet:url", ({ data, sender }) => {
		const tabId = sender.tab?.id;
		if (tabId != null) {
			activeMeetTabs.add(tabId);
			console.log("[kanpe] Meet tab registered:", tabId);
		}
		messenger.sendMessage("meet:url:relay", data);
	});

	// Open session viewer in popup window
	messenger.onMessage("session:open-viewer", ({ data }) => {
		chrome.windows.create({
			url: chrome.runtime.getURL(`/session-viewer.html?id=${data.id}`),
			type: "popup",
			width: 900,
			height: 600,
		});
	});

	// Helper: send meet:ended:relay to side panel
	function notifyMeetEnded(tabId: number) {
		if (!activeMeetTabs.has(tabId)) return;
		activeMeetTabs.delete(tabId);
		console.log("[kanpe] Meet ended for tab:", tabId);
		messenger.sendMessage("meet:ended:relay", undefined);
	}

	// Helper: check if URL is a Google Meet meeting
	function isMeetUrl(url: string | undefined): boolean {
		return !!url?.match(/^https:\/\/meet\.google\.com\/.+/);
	}

	// Helper: send meet context to side panel
	function sendMeetContext(isMeeting: boolean) {
		messenger.sendMessage("meet:context", { isMeeting });
	}

	// SidePanel init: respond with current tab's Meet context
	messenger.onMessage("sidepanel:init", async () => {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		return { isMeeting: isMeetUrl(tab?.url) };
	});

	// Detect Meet tab navigation away
	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		// Meet end detection: URL changed to non-Meet
		if (
			activeMeetTabs.has(tabId) &&
			changeInfo.url &&
			!isMeetUrl(changeInfo.url)
		) {
			notifyMeetEnded(tabId);
		}

		// Notify side panel of context change on URL update
		if (changeInfo.url) {
			sendMeetContext(isMeetUrl(changeInfo.url));
		}
	});

	// Detect tab switch: notify side panel of context change
	chrome.tabs.onActivated.addListener(async ({ tabId }) => {
		const tab = await chrome.tabs.get(tabId);
		sendMeetContext(isMeetUrl(tab.url));
	});

	// Detect Meet tab closed
	chrome.tabs.onRemoved.addListener((tabId) => {
		notifyMeetEnded(tabId);
	});

	// Side panel always enabled
	chrome.sidePanel.setOptions({ enabled: true });
	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
