import { messenger } from "../lib/messaging";
import type { Utterance } from "../lib/types";
import {
	SELECTORS,
	findCaptionContainer,
	parseCaptionDOM,
} from "../utils/caption-parser";

export default defineContentScript({
	matches: ["https://meet.google.com/*"],
	runAt: "document_idle",
	main() {
		console.log("[kanpe] Content script loaded");
		init();
	},
});

async function init(): Promise<void> {
	await enableCaptions();
	observeCaptions();
}

async function enableCaptions(): Promise<void> {
	const maxRetries = 10;
	const retryInterval = 2000;

	for (let i = 0; i < maxRetries; i++) {
		const activeButton = document.querySelector(
			`${SELECTORS.ccButtonActiveEn}, ${SELECTORS.ccButtonActiveJa}`,
		);
		if (activeButton) {
			console.log("[kanpe] Captions already enabled");
			return;
		}

		const ccButton = document.querySelector<HTMLButtonElement>(
			`${SELECTORS.ccButtonEn}, ${SELECTORS.ccButtonJa}`,
		);
		if (ccButton) {
			ccButton.click();
			console.log("[kanpe] Captions enabled via button click");
			return;
		}

		await new Promise((r) => setTimeout(r, retryInterval));
	}

	console.warn("[kanpe] CC button not found after retries");
}

// ── Caption observation ──

let observedElement: Element | null = null;
let observer: MutationObserver | null = null;

function debounce<T extends (...args: unknown[]) => void>(
	fn: T,
	ms: number,
): T {
	let timer: ReturnType<typeof setTimeout>;
	return ((...args: unknown[]) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	}) as T;
}

const debouncedSend = debounce((utterance: Utterance) => {
	console.log("[kanpe] Caption:", utterance.speaker, utterance.text);
	messenger.sendMessage("caption:new", utterance);
}, 300);

function observeCaptions(): void {
	const tryObserve = () => {
		const container = findCaptionContainer();
		if (!container || observedElement === container) return;

		observedElement = container;
		observer?.disconnect();

		observer = new MutationObserver(() => {
			const parsed = parseCaptionDOM(container);
			if (parsed) debouncedSend(parsed);
		});

		observer.observe(container, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		console.log("[kanpe] Caption observer attached to:", container);
	};

	// Initial attempt
	tryObserve();

	// Wait for caption container to appear (it only exists while someone is speaking)
	if (!observedElement) {
		const waitObserver = new MutationObserver(() => {
			if (!observedElement) tryObserve();
		});
		waitObserver.observe(document.body, { childList: true, subtree: true });
	}

	// Auto-reconnect if the container disappears (Meet re-renders it)
	setInterval(() => {
		if (observedElement && !document.contains(observedElement)) {
			console.log("[kanpe] Caption container lost, reconnecting...");
			observer?.disconnect();
			observedElement = null;
			observer = null;
			tryObserve();
		}
	}, 5000);
}
