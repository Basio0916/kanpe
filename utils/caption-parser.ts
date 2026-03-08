import type { Utterance } from "../lib/types";

// ── Selector stability notes ──
// High stability (accessibility attrs, rarely change):
//   [aria-label="字幕"], [aria-label="Captions"], [role="region"]
// Medium stability (Google internal identifier, changes occasionally):
//   [jscontroller="KPn5nb"]
// Low stability (obfuscated class names, change per deploy):
//   .vNKgIf, .nMcdL, .NWpY1d, .ygicle — DO NOT use

/**
 * Find a button whose aria-label contains one of the given keywords.
 * More resilient than exact-match selectors because Google Meet
 * occasionally appends keyboard-shortcut hints (e.g. "(c)") or
 * changes wording slightly.
 */
export function findButtonByLabel(
	keywords: string[],
): HTMLButtonElement | null {
	for (const btn of document.querySelectorAll<HTMLButtonElement>(
		"button[aria-label]",
	)) {
		const label = btn.getAttribute("aria-label") ?? "";
		if (keywords.some((kw) => label.includes(kw))) return btn;
	}
	return null;
}

// Track last utterance for deduplication
let lastUtterance: { speaker: string; text: string } | null = null;

/**
 * Find the caption container using stable selectors.
 * Priority: aria-label (JA/EN) → jscontroller fallback.
 */
export function findCaptionContainer(): Element | null {
	// Strategy 1: aria-label (most stable — accessibility attribute)
	const ariaLabel = document.querySelector(
		'[aria-label="字幕"], [aria-label="Captions"]',
	);
	if (ariaLabel) return ariaLabel;

	// Strategy 2: jscontroller fallback (medium stability)
	const jsCtrl = document.querySelector('[jscontroller="KPn5nb"]');
	if (jsCtrl) return jsCtrl;

	return null;
}

/**
 * Parse captions from the container using DOM structure (no class names).
 *
 * Known structure:
 *   <div aria-label="字幕">
 *     <div>                           ← utterance block (contains img for avatar)
 *       <div><img ...><span>話者名</span></div>  ← header (has img)
 *       <div>字幕テキスト...</div>                ← text   (no img)
 *     </div>
 *   </div>
 *
 * Split: child div with img = header (speaker), child div without img = text.
 */
export function parseCaptionDOM(container: Element): Utterance | null {
	// Utterance blocks = direct child divs that contain an img (avatar)
	const blocks: Element[] = [];
	for (const child of container.children) {
		if (child.tagName === "DIV" && child.querySelector("img")) {
			blocks.push(child);
		}
	}
	if (blocks.length === 0) return null;

	const lastBlock = blocks[blocks.length - 1];

	// Direct child divs of the utterance block
	const children = Array.from(lastBlock.children).filter(
		(el) => el.tagName === "DIV",
	);

	// Header = child div containing img (avatar + speaker name)
	const headerEl = children.find((el) => el.querySelector("img"));
	// Text = child div NOT containing img (caption body)
	const textEl = children.find((el) => !el.querySelector("img"));

	const speaker =
		headerEl?.querySelector("span")?.textContent?.trim() ?? "Unknown";
	const text = textEl?.textContent?.trim() ?? "";

	if (!text || text.length < 2) return null;

	// Deduplicate
	if (lastUtterance?.speaker === speaker && lastUtterance?.text === text) {
		return null;
	}
	lastUtterance = { speaker, text };

	return {
		speaker,
		text,
		time: new Date().toLocaleTimeString("ja-JP", { hour12: false }),
	};
}
