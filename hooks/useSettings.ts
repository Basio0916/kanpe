import { useEffect, useState } from "react";
import type { ProviderId, ProviderSettings } from "../lib/ai-provider";
import { messenger } from "../lib/messaging";
import { DEFAULT_SETTINGS } from "../lib/provider-settings";

export function useSettings() {
	const [settings, setSettings] = useState<ProviderSettings>(DEFAULT_SETTINGS);
	const [isSaving, setIsSaving] = useState(false);
	const [saveResult, setSaveResult] = useState<"success" | "error" | null>(
		null,
	);

	useEffect(() => {
		messenger
			.sendMessage("settings:getProviderSettings", undefined)
			.then(setSettings);
	}, []);

	const updateProvider = (id: ProviderId) => {
		setSaveResult(null);
		setSettings((prev) => ({ ...prev, activeProvider: id }));
	};

	const updateProviderConfig = <T extends ProviderId>(
		id: T,
		partial: Partial<ProviderSettings["configs"][T]>,
	) => {
		setSaveResult(null);
		setSettings((prev) => ({
			...prev,
			configs: {
				...prev.configs,
				[id]: { ...prev.configs[id], ...partial },
			},
		}));
	};

	const save = async () => {
		setIsSaving(true);
		setSaveResult(null);
		try {
			await messenger.sendMessage("settings:setProviderSettings", settings);
			setSaveResult("success");
		} catch {
			setSaveResult("error");
		} finally {
			setIsSaving(false);
		}
	};

	return {
		settings,
		updateProvider,
		updateProviderConfig,
		save,
		isSaving,
		saveResult,
	};
}
