import { Token, TokenSchema, ParsedToken, TextToken } from "./EditorBase.ts";

const codeBlockRegex =
	/^(?<!\\)((?:\`|~){3})(?!(?:[ \t\`~]*\1)|[\`~]+?)([^\s\`~]*)([\s\S]*?)(?<!\\)\1$/gm;

export default class CodeBlock extends ParsedToken {
	startFence: TextToken | undefined;
	lang: TextToken | undefined;
	endFence: TextToken | undefined;

	constructor(start: number, match: RegExpExecArray) {
		super(start, match);
		this.name = "codeBlock";
		this.parse(match);
	}

	parse(match?: RegExpExecArray): boolean {
		if (!match) {
			match = codeBlockRegex.exec(this.value) ?? undefined;
		}
		if (match) {
			console.log(match);
			let { fence, lang, text } = match.groups!;
			this.startFence = new TextToken(this.start, fence);
			this.endFence = new TextToken(this.end - fence.length, fence);
			if (lang) {
				this.lang = new TextToken(this.start + fence.length, lang);
				this.tokens.push(
					new TextToken(this.start + fence.length + lang.length, text),
				);
			} else {
				this.tokens.push(new TextToken(this.start + fence.length, text));
			}
			return true;
		} else {
			return false;
		}
	}

	render(): string {
		let html = super.render();
		if (this.lang) {
			return `<pre><code><span class="peek">${this.startFence!.value}</span><span class="code-lang">${this.lang.value}</span>${html}<span class="peek">${this.endFence!.value}</span></code></pre>`;
		} else {
			return `<pre><code><span class="peek">${this.startFence!.value}</span>${html}<span class="peek">${this.endFence!.value}</span></code></pre>`;
		}
	}

	toString(depth: number = 0, extras?: string[]): string {
		let myExtras = [];
		myExtras.push(`startFence: ${this.startFence!.toString()}`);
		if (this.lang) {
			myExtras.push(`lang: ${this.lang.toString()}`);
		}
		myExtras.push(`endFence: ${this.endFence!.toString()}`);
		return super.toString(depth, myExtras);
	}
}

Token.addBlockSchema(new TokenSchema(codeBlockRegex, CodeBlock));
