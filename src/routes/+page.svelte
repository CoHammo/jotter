<script lang="ts">
	import { Marked } from "marked";
	import xTables from "@fsegurai/marked-extended-tables";
	import linkify from "marked-linkify-it";
	import * as rust from "$lib/rust.svelte.ts";
	import { untrack } from "svelte";

	const md = new Marked();

	// const hooks = {
	//     preprocess(markdown: string) {
	//         return markdown.replace(/\n{2,}/g, (match) => {
	//             const brCount = match.length - 1;
	//             return "\n\n" + "<br>".repeat(brCount) + "\n\n";
	//         });
	//     },
	// };
	// md.use({ hooks }, xTables(), linkify({}, {}));

	const renderer = {
		// heading({ tokens, depth }) {
		// 	const text = this.parser.parseInline(tokens);
		// 	const escapedText = text.toLowerCase().replace(/[^\w]+/g, "-");
		// 	return `<h${depth}><span class="hhash">${"#".repeat(depth)}</span> ${text}</h${depth}>`;
		// },
	};

	md.use({ renderer, async: false }, xTables(), linkify({}, {}));

	let renderTime = $state(0);
	let markdown = $state("# Jotter!");
	let tokens = $state(md.lexer(markdown));
	let rendermark = $state("");
	$effect(() => {
		// let start = performance.now();
		// rust.parse_markdown(markdown).then((result) => {
		// 	untrack(() => {
		// 		rendermark = result;
		// 		let end = performance.now();
		// 		renderTime = end - start;
		// 	});
		// });

		let start = performance.now();
		let result = md.lexer(markdown);
		untrack(() => {
			tokens = result;
			rendermark = md.parser(result);
			let end = performance.now();
			renderTime = end - start;
		});
	});
	let markdownBox: HTMLTextAreaElement | undefined = $state();
	let renderBox: HTMLDivElement | undefined = $state();
	let caret = $state({ pos: 0, range: document.createRange() });

	function updateCaret() {
		const sel = window.getSelection();
		if (sel && sel?.type == "Caret" && sel.rangeCount > 0 && renderBox) {
			let range = sel.getRangeAt(0);
			let offset = range.cloneRange();
			offset.selectNodeContents(renderBox);
			offset.setEnd(range.endContainer, range.endOffset);
			caret = { pos: offset.toString().length, range: offset };
		}
	}

	function editMarkdown(e: Event) {
		if (renderBox) {
			let oldCaret = caret;
			markdown = renderBox.innerText.slice(0, -1);
			const sel = window.getSelection();
			sel?.collapse(renderBox, 2);
		}
	}
</script>

<div
	class="grid grid-cols-2 grid-rows-[1fr_1fr_0.1fr] gap-0.5 h-full bg-black *:bg-white *:p-3"
>
	<textarea
		bind:this={markdownBox}
		class="resize-none outline-none"
		name="rawmark"
		id="rawmark"
		bind:value={markdown}
	>
	</textarea>
	<div
		bind:this={renderBox}
		bind:innerHTML={rendermark}
		role="textbox"
		tabindex="0"
		aria-multiline="true"
		contenteditable
		oninput={editMarkdown}
		onkeydown={updateCaret}
		onkeyup={updateCaret}
		onclick={updateCaret}
		class="my-markdown outline-none overflow-auto"
	></div>
	<textarea>
		{JSON.stringify(tokens, null, 2)}
	</textarea>
	<div class="overflow-auto">
		{rendermark}
	</div>
	<div
		class="flex h-10 flex-row col-span-full items-center bg-gray-200 gap-1"
	>
		<button
			class="h-8 hover:cursor-pointer hover:bg-amber-400 bg-amber-300 transition-all rounded font-bold px-3"
			onclick={async () => {
				markdown = await rust.load_file();
			}}>Load MD</button
		>
		<div class="font-mono text-sm">CPos: {caret.pos},</div>
		<div class="font-mono text-sm">MDLen: {markdown.length},</div>
		<div class="font-mono text-sm">
			RendLen: {renderBox?.innerText?.length ?? "0"},
		</div>
		<div class="font-mono text-sm">TLen: {tokens.length}</div>
		<div class="font-mono text-sm ml-auto">
			RTime: {renderTime.toFixed(0)}ms
		</div>
		<button
			class="h-8 hover:cursor-pointer hover:bg-amber-400 bg-amber-300 transition-all rounded font-bold px-3"
			onclick={async () => {
				let tokens = await rust.load_file();
				let start = performance.now();
				let edit = await rust.edit(tokens, 243581);
				// await rust.save_markdown(text);
				let end = performance.now();
				console.log(`${(end - start).toFixed(2)}ms`);
			}}>Load MD</button
		>
	</div>
</div>

<style lang="postcss">
	@reference "../app.css";

	.my-markdown :global {
		.hhash {
			@apply text-zinc-600 -z-1 static opacity-100;
		}
		h1 {
			@apply text-5xl font-bold mb-3;
		}
		h2 {
			@apply text-4xl font-bold mb-2;
		}
		h3 {
			@apply text-3xl font-bold mb-2;
		}
		h4 {
			@apply text-2xl font-bold mb-2;
		}
		h5 {
			@apply text-xl font-bold mb-2;
		}
		h6 {
			@apply text-lg font-bold mb-2;
		}

		li {
			&:before {
				content: "\2022  ";
			}
		}

		a {
			@apply text-blue-800 underline;
		}

		table {
			@apply border border-gray-500 my-2 text-center;
		}
		tr:nth-child(odd) {
			@apply bg-gray-100;
		}
		td {
			@apply px-2 py-1 border;
		}
		th {
			@apply px-2 py-1 border bg-white;
		}
	}
</style>
