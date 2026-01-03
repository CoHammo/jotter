<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { Editor } from "@tiptap/core";
	import StarterKit from "@tiptap/starter-kit";
	import { Markdown } from "tiptap-markdown";

	let element: HTMLDivElement;
	let editor: Editor;

	let markdown = `# Jotter! (C)\nyoutube.com\n
| Hello | Sir |
| - | - |
| Collin | Hammond |
| is | cool |

Hello
- This is good
- I hope
`;

	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [
				StarterKit,
				Markdown.configure({
					html: true,
					transformPastedText: true,
					transformCopiedText: true,
				}),
			],
			content: markdown,
			onTransaction: () => {
				// force re-assign
				editor = editor;
			},
			onUpdate: ({ editor }) => {
				markdown = editor.storage.markdown.getMarkdown();
			},
			editorProps: {
				attributes: {
					class: "outline-none h-full overflow-auto max-w-3xl mx-auto p-4 prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none",
				},
			},
		});
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});
</script>

<style>
	@reference "../../app.css";

	/* Global styling for TipTap's ProseMirror instance if needed, 
	   though we are using Tailwind prose classes on the element itself. */
	:global(.ProseMirror) {
		height: 100%;
		outline: none;
	}

	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #adb5bd;
		pointer-events: none;
		height: 0;
	}
</style>
