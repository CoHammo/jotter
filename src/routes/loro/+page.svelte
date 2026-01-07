<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { Editor, Extension } from "@tiptap/core";
    import Document from "@tiptap/extension-document";
    import Paragraph from "@tiptap/extension-paragraph";
    import Text from "@tiptap/extension-text";
    import History from "@tiptap/extension-history";
    import { Plugin, PluginKey } from "@tiptap/pm/state";
    import { Decoration, DecorationSet } from "@tiptap/pm/view";
    import * as rust from "$lib/rust.svelte.ts";

    let element: HTMLDivElement;
    let editor: Editor | undefined;
    let currentMarkdown = "";

    // Custom Extension for Live Preview
    const LivePreview = Extension.create({
        name: "livePreview",
        addProseMirrorPlugins() {
            return [
                new Plugin({
                    key: new PluginKey("live-preview"),
                    props: {
                        decorations(state) {
                            const { doc, selection } = state;
                            const decorations: Decoration[] = [];
                            const isFocused = true; // Could track editor focus state if desired
                            const selectionFrom = selection.from;
                            const selectionTo = selection.to;

                            doc.descendants((node, pos) => {
                                if (!node.isText) return;

                                const text = node.text || "";

                                // --- Regex Patterns ---

                                // Heading: # Heading match
                                const headingRegex = /^(#{1,6})\s(.*)$/gm;
                                let match;
                                while (
                                    (match = headingRegex.exec(text)) !== null
                                ) {
                                    const start = pos + match.index;
                                    const end = start + match[0].length;
                                    const syntaxEnd =
                                        start + match[1].length + 1; // +1 for space

                                    // Content decoration (always applied)
                                    decorations.push(
                                        Decoration.inline(start, end, {
                                            class: `markdown-heading markdown-h${match[1].length}`,
                                        }),
                                    );

                                    // Syntax decoration (Hide if not focused)
                                    // Check overlap with selection
                                    const isSelected =
                                        selectionTo >= start &&
                                        selectionFrom <= end;
                                    if (!isSelected) {
                                        decorations.push(
                                            Decoration.inline(
                                                start,
                                                syntaxEnd,
                                                {
                                                    class: "syntax-hidden",
                                                },
                                            ),
                                        );
                                    } else {
                                        decorations.push(
                                            Decoration.inline(
                                                start,
                                                syntaxEnd,
                                                {
                                                    class: "syntax-visible", // Optional coloring
                                                },
                                            ),
                                        );
                                    }
                                }

                                // Bold: **bold**
                                const boldRegex = /(\*\*)(.*?)\1/g;
                                while (
                                    (match = boldRegex.exec(text)) !== null
                                ) {
                                    const start = pos + match.index;
                                    const end = start + match[0].length;
                                    const contentStart = start + 2;
                                    const contentEnd = end - 2;

                                    // Style Content
                                    decorations.push(
                                        Decoration.inline(start, end, {
                                            class: "markdown-bold",
                                        }),
                                    );

                                    // Check overlap
                                    const isSelected =
                                        selectionTo >= start &&
                                        selectionFrom <= end;
                                    if (!isSelected) {
                                        // Hide opening **
                                        decorations.push(
                                            Decoration.inline(
                                                start,
                                                contentStart,
                                                { class: "syntax-hidden" },
                                            ),
                                        );
                                        // Hide closing **
                                        decorations.push(
                                            Decoration.inline(contentEnd, end, {
                                                class: "syntax-hidden",
                                            }),
                                        );
                                    } else {
                                        decorations.push(
                                            Decoration.inline(
                                                start,
                                                contentStart,
                                                { class: "syntax-visible" },
                                            ),
                                        );
                                        decorations.push(
                                            Decoration.inline(contentEnd, end, {
                                                class: "syntax-visible",
                                            }),
                                        );
                                    }
                                }

                                // Italic: *italic*
                                const italicRegex = /(\*)(.*?)\1/g; // Simplified, assumes single *
                                while (
                                    (match = italicRegex.exec(text)) !== null
                                ) {
                                    // Prevent matching bold (**...**) as italic parts
                                    if (match[0].startsWith("**")) continue;

                                    const start = pos + match.index;
                                    const end = start + match[0].length;
                                    const contentStart = start + 1;
                                    const contentEnd = end - 1;

                                    decorations.push(
                                        Decoration.inline(start, end, {
                                            class: "markdown-italic",
                                        }),
                                    );

                                    const isSelected =
                                        selectionTo >= start &&
                                        selectionFrom <= end;
                                    if (!isSelected) {
                                        decorations.push(
                                            Decoration.inline(
                                                start,
                                                contentStart,
                                                { class: "syntax-hidden" },
                                            ),
                                        );
                                        decorations.push(
                                            Decoration.inline(contentEnd, end, {
                                                class: "syntax-hidden",
                                            }),
                                        );
                                    } else {
                                        decorations.push(
                                            Decoration.inline(
                                                start,
                                                contentStart,
                                                { class: "syntax-visible" },
                                            ),
                                        );
                                        decorations.push(
                                            Decoration.inline(contentEnd, end, {
                                                class: "syntax-visible",
                                            }),
                                        );
                                    }
                                }
                            });

                            return DecorationSet.create(doc, decorations);
                        },
                    },
                }),
            ];
        },
    });

    onMount(async () => {
        // Fetch initial state
        currentMarkdown = await invoke("loro_get_text");

        editor = new Editor({
            element: element,
            extensions: [Document, Paragraph, Text, History, LivePreview],
            content: currentMarkdown,
            onUpdate: ({ editor }) => {
                // Since we are in "Source Mode" (Paragraphs), getText() returns the raw markdown formatted text
                // strictly speaking, it returns plain text.
                const newMarkdown = editor.getText();
                handleUpdate(newMarkdown);
            },
            editorProps: {
                attributes: {
                    class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none p-4 w-full max-w-none h-full whitespace-pre-wrap font-mono",
                },
            },
        });
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    async function handleUpdate(newValue: string) {
        const oldValue = currentMarkdown;
        currentMarkdown = newValue;

        let start = 0;
        while (
            start < oldValue.length &&
            start < newValue.length &&
            oldValue[start] === newValue[start]
        ) {
            start++;
        }
        let oldEnd = oldValue.length;
        let newEnd = newValue.length;
        while (
            oldEnd > start &&
            newEnd > start &&
            oldValue[oldEnd - 1] === newValue[newEnd - 1]
        ) {
            oldEnd--;
            newEnd--;
        }

        const deleteCount = oldEnd - start;
        const insertText = newValue.slice(start, newEnd);

        if (deleteCount > 0 || insertText.length > 0) {
            await invoke("loro_update_text", {
                start,
                deleteCount,
                insertText,
            });
        }
    }
</script>

<div class="flex h-screen w-full flex-col">
    <div
        bind:this={element}
        class="flex-1 w-full overflow-y-auto border border-gray-300 rounded m-2 bg-white shadow-sm"
    ></div>

    <div class="flex flex-row items-center bg-gray-200 gap-2 m-2 p-2 rounded">
        <button
            class="h-8 hover:cursor-pointer hover:bg-amber-400 bg-amber-300 transition-all rounded font-bold px-3"
            onclick={async () => {
                const fileContent = await rust.load_file();
                if (editor) {
                    const oldLength = currentMarkdown.length;
                    editor.commands.setContent(fileContent);
                    // setContent is asynchronous/triggers update.
                    // To be safe and precise with Loro, we might handle update manually or rely on onUpdate
                    // Here we rely on onUpdate picking up the change
                }
            }}>Load MD</button
        >
        <span class="text-xs text-gray-500">Obsidian-like Mode</span>
    </div>
</div>

<style lang="postcss">
    @reference "../../app.css";

    /* Editor Styles */
    :global(.ProseMirror) {
        height: 100%;
        outline: none;
    }

    /* Live Preview Styles */
    :global(.syntax-hidden) {
        font-size: 0;
        visibility: hidden;
    }
    :global(.syntax-visible) {
        @apply text-gray-400 font-normal text-base;
    }

    :global(.markdown-heading) {
        @apply font-bold text-gray-800;
    }
    :global(.markdown-h1) {
        @apply text-4xl;
    }
    :global(.markdown-h2) {
        @apply text-3xl;
    }
    :global(.markdown-h3) {
        @apply text-2xl;
    }

    :global(.markdown-bold) {
        @apply font-bold;
    }
    :global(.markdown-italic) {
        @apply italic;
    }
</style>
