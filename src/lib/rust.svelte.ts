import { invoke } from "@tauri-apps/api/core";
import { marked, type TokensList } from "marked";

export const text = "# Jotter!\nyoutube.com";

// const decoder = new TextDecoder('utf-8');

export async function load_file(): Promise<TokensList> {
	let text = (await invoke("read_file", {
		path: "/mnt/ssd/CodeProjects/jotter/src/routes/initmark.md",
	})) as string;

	let result = marked.lexer(text.repeat(30));
	console.log(`Tokens: ${result.length}`);
	return result;
}

export async function edit(tokens: TokensList, index: number): Promise<string> {
	let result = marked.parser(tokens);
	return result;
}

export async function save_markdown(markdown: string) {
	await invoke("save_markdown", { markdown: markdown });
}

export async function parse_markdown(markdown: string): Promise<string> {
	let buffer = (await invoke("parse_markdown", {
		markdown: markdown,
	})) as ArrayBuffer;
	let html = new TextDecoder().decode(buffer);
	return html;
}
