// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const ssr = false;

import { warn, debug, trace, info, error } from "@tauri-apps/plugin-log";

function forwardConsole(
	fnName: "log" | "debug" | "info" | "warn" | "error",
	logger: (message: string) => Promise<void>,
) {
	const original = console[fnName];
	console[fnName] = (message: any[]) => {
		original(message);
		if ("__TAURI_EVENT_PLUGIN_INTERNALS__" in window) {
			logger(message.toString());
		}
	};
}

forwardConsole("log", trace);
forwardConsole("debug", debug);
forwardConsole("info", info);
forwardConsole("warn", warn);
forwardConsole("error", error);
