import { defineExtensionMessaging } from "@webext-core/messaging";
import type { AiAction, AiResponse, ChatMessage, Utterance } from "./types";

interface ProtocolMap {
	// Content Script → Background
	"caption:new"(data: {
		speaker: string;
		text: string;
		time: string;
	}): void;

	// Background → Side Panel
	"caption:relay"(data: {
		speaker: string;
		text: string;
		time: string;
	}): void;

	// Side Panel → Background → Side Panel
	"ai:request"(data: {
		action: AiAction;
		utterances: Utterance[];
	}): AiResponse;

	// Side Panel → Background → Side Panel
	"chat:send"(data: {
		message: string;
		utterances: Utterance[];
		history: ChatMessage[];
	}): AiResponse;

	// Settings
	"settings:getApiKey"(): string | null;
	"settings:setApiKey"(key: string): void;
}

export const messenger = defineExtensionMessaging<ProtocolMap>();
