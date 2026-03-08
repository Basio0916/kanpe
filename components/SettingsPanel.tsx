import type { FormEvent } from "react";
import { useSettings } from "../hooks/useSettings";
import type { ProviderConfigMap, ProviderId } from "../lib/ai-provider";

const PROVIDERS: { id: ProviderId; label: string }[] = [
	{ id: "anthropic", label: "Anthropic" },
	{ id: "openai", label: "OpenAI" },
	{ id: "ollama", label: "Ollama" },
];

function AnthropicForm({
	config,
	onChange,
}: {
	config: ProviderConfigMap["anthropic"];
	onChange: (partial: Partial<ProviderConfigMap["anthropic"]>) => void;
}) {
	return (
		<div className="space-y-3">
			<Field label="API Key">
				<input
					type="password"
					value={config.apiKey}
					onChange={(e) => onChange({ apiKey: e.target.value })}
					placeholder="sk-ant-..."
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</Field>
			<Field label="Model">
				<input
					type="text"
					value={config.model}
					onChange={(e) => onChange({ model: e.target.value })}
					placeholder="claude-haiku-4-5"
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</Field>
		</div>
	);
}

function OpenAiForm({
	config,
	onChange,
}: {
	config: ProviderConfigMap["openai"];
	onChange: (partial: Partial<ProviderConfigMap["openai"]>) => void;
}) {
	return (
		<div className="space-y-3">
			<Field label="API Key">
				<input
					type="password"
					value={config.apiKey}
					onChange={(e) => onChange({ apiKey: e.target.value })}
					placeholder="sk-..."
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</Field>
			<Field label="Model">
				<input
					type="text"
					value={config.model}
					onChange={(e) => onChange({ model: e.target.value })}
					placeholder="gpt-4o-mini"
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</Field>
			<Field label="Base URL">
				<input
					type="text"
					value={config.baseUrl}
					onChange={(e) => onChange({ baseUrl: e.target.value })}
					placeholder="https://api.openai.com"
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</Field>
		</div>
	);
}

function OllamaForm({
	config,
	onChange,
}: {
	config: ProviderConfigMap["ollama"];
	onChange: (partial: Partial<ProviderConfigMap["ollama"]>) => void;
}) {
	return (
		<div className="space-y-3">
			<Field label="Model">
				<input
					type="text"
					value={config.model}
					onChange={(e) => onChange({ model: e.target.value })}
					placeholder="llama3.2"
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</Field>
			<Field label="Base URL">
				<input
					type="text"
					value={config.baseUrl}
					onChange={(e) => onChange({ baseUrl: e.target.value })}
					placeholder="http://localhost:11434"
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</Field>
			<p className="text-xs text-gray-500">
				If you get a 403 error, start Ollama with:
				<code className="block mt-1 px-2 py-1 bg-gray-100 rounded text-gray-700">
					OLLAMA_ORIGINS=* ollama serve
				</code>
			</p>
		</div>
	);
}

function Field({
	label,
	children,
}: { label: string; children: React.ReactNode }) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: children contains the input
		<label className="block">
			<span className="block text-sm font-medium text-gray-700 mb-1">
				{label}
			</span>
			{children}
		</label>
	);
}

export function SettingsPanel() {
	const {
		settings,
		updateProvider,
		updateProviderConfig,
		save,
		isSaving,
		saveResult,
	} = useSettings();

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		save();
	};

	return (
		<div className="p-4 space-y-4">
			<h2 className="text-lg font-semibold">Settings</h2>

			<form onSubmit={handleSubmit} className="space-y-4">
				{/* Provider selection */}
				<fieldset className="space-y-2">
					<legend className="text-sm font-medium text-gray-700">
						AI Provider
					</legend>
					{PROVIDERS.map(({ id, label }) => (
						<label key={id} className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="provider"
								value={id}
								checked={settings.activeProvider === id}
								onChange={() => updateProvider(id)}
								className="accent-blue-500"
							/>
							<span className="text-sm">{label}</span>
						</label>
					))}
				</fieldset>

				{/* Provider-specific config */}
				<div className="border-t pt-4">
					{settings.activeProvider === "anthropic" && (
						<AnthropicForm
							config={settings.configs.anthropic}
							onChange={(p) => updateProviderConfig("anthropic", p)}
						/>
					)}
					{settings.activeProvider === "openai" && (
						<OpenAiForm
							config={settings.configs.openai}
							onChange={(p) => updateProviderConfig("openai", p)}
						/>
					)}
					{settings.activeProvider === "ollama" && (
						<OllamaForm
							config={settings.configs.ollama}
							onChange={(p) => updateProviderConfig("ollama", p)}
						/>
					)}
				</div>

				{saveResult === "success" && (
					<p className="text-sm text-green-500">Settings saved successfully.</p>
				)}
				{saveResult === "error" && (
					<p className="text-sm text-red-500">Failed to save settings.</p>
				)}

				<button
					type="submit"
					disabled={isSaving}
					className="w-full px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{isSaving ? "Saving..." : "Save"}
				</button>
			</form>
		</div>
	);
}
