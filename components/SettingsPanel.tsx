import { type FormEvent, useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";

function ApiKeyForm({
	value,
	onSave,
	isValid,
	isSaving,
}: {
	value: string;
	onSave: (key: string) => void;
	isValid: boolean | null;
	isSaving: boolean;
}) {
	const [input, setInput] = useState(value);

	useEffect(() => {
		if (value) setInput(value);
	}, [value]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		onSave(input);
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<div>
				<label
					htmlFor="apiKey"
					className="block text-sm font-medium text-gray-700 mb-1"
				>
					Anthropic API Key
				</label>
				<input
					id="apiKey"
					type="password"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="sk-ant-..."
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
			{isValid === false && (
				<p className="text-sm text-red-500">
					Invalid API key. Must start with &quot;sk-ant-&quot;.
				</p>
			)}
			{isValid === true && (
				<p className="text-sm text-green-500">API key saved successfully.</p>
			)}
			<button
				type="submit"
				disabled={isSaving || !input.trim()}
				className="w-full px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{isSaving ? "Saving..." : "Save"}
			</button>
		</form>
	);
}

export function SettingsPanel() {
	const { apiKey, saveApiKey, isValid, isSaving } = useSettings();

	return (
		<div className="p-4 space-y-4">
			<h2 className="text-lg font-semibold">Settings</h2>
			<ApiKeyForm
				value={apiKey}
				onSave={saveApiKey}
				isValid={isValid}
				isSaving={isSaving}
			/>
		</div>
	);
}
