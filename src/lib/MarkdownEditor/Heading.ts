import { Token, TokenSchema, ParsedToken, TextToken } from "./EditorBase.ts";

const headingRegex = /^(#{1,6} )(.*\n?)|(.+\n)(?:(=+|-+)\n?)/gm;

export default class Heading extends ParsedToken {
	hashes: TextToken | undefined; // includes the space between hashes and text
	lines: TextToken | undefined;

	get depth(): number {
		if (this.hashes) {
			return this.hashes.length - 1;
		} else if (this.lines) {
			if (this.lines.value.includes("=")) return 1;
			else return 2;
		} else {
			return 1;
		}
	}

	constructor(start: number, match: RegExpExecArray) {
		super(start, match);
		this.name = "heading";
		this.parse(match);
	}

	parse(match?: RegExpExecArray): boolean {
		if (!match) {
			match = headingRegex.exec(this.value) ?? undefined;
		}
		if (match) {
			let [value, hashes, htext, ltext, lines] = match;
			if (hashes) {
				this.hashes = new TextToken(this.start, hashes);
				this.tokens.push(
					new TextToken(this.start + (hashes?.length ?? 0), htext),
				);
			} else {
				this.lines = new TextToken(this.end - lines.length, lines);
				this.tokens.push(
					new TextToken(this.start + (hashes?.length ?? 0), ltext),
				);
			}
			// this.parseInline();
			return true;
		} else {
			return false;
		}
	}

	render(): string {
		let depth = this.depth;
		let html = super.render();
		if (this.hashes) {
			return `<h${depth}><span class="peek">${this.hashes.value}</span>${html}</h${depth}>`;
		} else if (this.lines) {
			return `<h${depth}>${html}<br><span class="peek">${this.lines.value}</span></h${depth}>`;
		} else {
			return `<h${depth}>${html}</h${depth}>`;
		}
	}

	toString(depth: number = 0, extras?: string[]): string {
		let myExtras = [`depth: ${this.depth}`];
		if (this.hashes) {
			myExtras.push(`hashes: ${this.hashes.toString()}`);
		} else if (this.lines) {
			myExtras.push(`lines: ${this.lines.toString()}`);
		}
		return super.toString(depth, myExtras);
	}
}

Token.addBlockSchema(new TokenSchema(headingRegex, Heading));
