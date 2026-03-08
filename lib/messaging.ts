import { defineExtensionMessaging } from "@webext-core/messaging";
import type { ProviderSettings } from "./ai-provider";
import type {
	AiAction,
	AiResponse,
	ChatMessage,
	Session,
	SessionSummary,
	Utterance,
} from "./types";

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
	"settings:getProviderSettings"(): ProviderSettings;
	"settings:setProviderSettings"(settings: ProviderSettings): void;

	// Sessions
	"session:list"(): SessionSummary[];
	"session:get"(data: { id: string }): Session | null;
	"session:save"(data: Session): void;
	"session:delete"(data: { id: string }): void;

	// Meet URL: Content → Background → SidePanel
	"meet:url"(data: { url: string }): void;
	"meet:url:relay"(data: { url: string }): void;

	// Meet ended: Background → SidePanel
	"meet:ended:relay"(): void;

	// Session viewer: SidePanel → Background
	"session:open-viewer"(data: { id: string }): void;
}

export const messenger = defineExtensionMessaging<ProtocolMap>();
