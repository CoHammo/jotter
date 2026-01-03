<script>
	import { onMount } from "svelte";
	// import { open } from "@tauri-apps/plugin-opener";
	import "../app.css";

	let { children } = $props();
</script>

<header
	class="bg-zinc-900 text-white h-12 justify-center items-center flex gap-4"
>
	<a href="/">Marked</a>
	<a href="/tiptap">TipTap</a>
</header>

<main class="main-content">{@render children()}</main>

<style lang="postcss">
	@reference "../app.css";

	.main-content {
		height: calc(100vh - 3rem);
		@apply flex flex-col;
	}
</style>
