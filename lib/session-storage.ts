import type { Session, SessionSummary } from "./types";

const INDEX_KEY = "sessionIndex";
const sessionKey = (id: string) => `session:${id}`;

export async function getSessionIndex(): Promise<SessionSummary[]> {
	const { [INDEX_KEY]: index } = await chrome.storage.local.get(INDEX_KEY);
	return (index as SessionSummary[] | undefined) ?? [];
}

export async function getSession(id: string): Promise<Session | null> {
	const key = sessionKey(id);
	const { [key]: session } = await chrome.storage.local.get(key);
	return (session as Session | undefined) ?? null;
}

export async function saveSession(session: Session): Promise<void> {
	const key = sessionKey(session.id);
	await chrome.storage.local.set({ [key]: session });

	const index = await getSessionIndex();
	const summary: SessionSummary = {
		id: session.id,
		title: session.title,
		createdAt: session.createdAt,
		utteranceCount: session.utterances.length,
		chatMessageCount: session.chatHistory.length,
	};

	const existing = index.findIndex((s) => s.id === session.id);
	if (existing >= 0) {
		index[existing] = summary;
	} else {
		index.unshift(summary);
	}

	await chrome.storage.local.set({ [INDEX_KEY]: index });
}

export async function deleteSession(id: string): Promise<void> {
	await chrome.storage.local.remove(sessionKey(id));

	const index = await getSessionIndex();
	const filtered = index.filter((s) => s.id !== id);
	await chrome.storage.local.set({ [INDEX_KEY]: filtered });
}
