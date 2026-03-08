import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	manifest: {
		name: "Kanpe - Google Meet AI Assistant",
		description:
			"AI-powered meeting assistant for Google Meet. Real-time captions, summaries, and suggestions.",
		permissions: ["sidePanel", "activeTab", "storage"],
		host_permissions: [
			"https://meet.google.com/*",
			"https://api.anthropic.com/*",
			"https://api.openai.com/*",
			"http://localhost:*/*",
			"http://127.0.0.1:*/*",
		],
	},
	vite: () => ({
		plugins: [tailwindcss()],
	}),
});
