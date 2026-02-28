import { useEffect, useState } from "react";
import { messenger } from "../lib/messaging";

export function useSettings() {
	const [apiKey, setApiKey] = useState("");
	const [isValid, setIsValid] = useState<boolean | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		messenger.sendMessage("settings:getApiKey", undefined).then((key) => {
			if (key) setApiKey(key);
		});
	}, []);

	const saveApiKey = async (key: string) => {
		const valid = key.startsWith("sk-ant-");
		setIsValid(valid);
		if (!valid) return;

		setIsSaving(true);
		try {
			await messenger.sendMessage("settings:setApiKey", key);
			setApiKey(key);
		} finally {
			setIsSaving(false);
		}
	};

	return { apiKey, saveApiKey, isValid, isSaving };
}
