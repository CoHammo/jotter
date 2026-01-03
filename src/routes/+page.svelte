<script lang="ts">
	import { Marked } from "marked";
	import xTables from "@fsegurai/marked-extended-tables";
	import linkify from "marked-linkify-it";
	import { warn, debug, trace, info, error } from "@tauri-apps/plugin-log";

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
		heading({ tokens, depth }) {
			const text = this.parser.parseInline(tokens);
			const escapedText = text.toLowerCase().replace(/[^\w]+/g, "-");

			return `<h${depth}><span class="hhash">${"#".repeat(depth)}</span> ${text}</h${depth}>`;
		},
	};

	md.use({ renderer }, xTables(), linkify({}, {}));

	let rawmark = $state(`# Jotter!\nyoutube.com`);
	let rendermark: HTMLDivElement | undefined = $state();
	let caretPos = $state(0);

	function updateCaretPos() {
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0 && rendermark) {
			const range = selection.getRangeAt(0);
			const preCaretRange = range.cloneRange();
			preCaretRange.selectNodeContents(rendermark);
			preCaretRange.setEnd(range.endContainer, range.endOffset);
			caretPos = preCaretRange.toString().length;
		}
	}
</script>

<div class="flex flex-row h-full pt-2">
	<textarea
		class="flex-1 resize-none outline-none px-3"
		name="rawmark"
		id="rawmark"
		bind:value={rawmark}
	></textarea>
	<div class="w-0.5 h-full bg-black"></div>
	<div
		bind:this={rendermark}
		role="textbox"
		tabindex="0"
		aria-multiline="true"
		contenteditable
		onbeforeinput={(e) => e.preventDefault()}
		onkeyup={updateCaretPos}
		onclick={updateCaretPos}
		class="h-full flex-1 p-2 my-markdown px-3 outline-none"
	>
		{@html md.parse(rawmark)}
	</div>
</div>
<div class="flex flex-row items-center bg-gray-200 gap-2 m-2">
	<button
		class="h-8 hover:cursor-pointer hover:bg-amber-400 bg-amber-300 transition-all rounded font-bold px-3"
		onclick={() => info(rendermark?.innerText ?? "")}>Log MD</button
	>
	<div class="font-mono text-sm">CPos: {caretPos},</div>
	<div class="font-mono text-sm">MDLen: {rawmark.length},</div>
	<div class="font-mono text-sm">
		RendLen: {rendermark?.innerText?.length ?? "0"}
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
