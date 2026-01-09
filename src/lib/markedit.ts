const Regex = {
	// blocks
	heading: String.raw`(?:^(?<hashes>#{1,6} )(?<text>.*)|(?<text>.+)(?<lines>\n(?:=+|-+)))\n?`,
	code: String.raw`(?:(?<!\\)(?<fence>(?:\`|~){3})(?!(?:[ \t\`~]*\k<fence>)|[\`~]+?)(?<lang>[^\s\`~]*)(?<text>[\s\S]*?)(?<!\\)\k<fence>)`,
	// paragraph: String.raw`(?:\r?\n|^)(?![#>-]|\s*[*+-]|\s*\d+\.|\`{3,}|~{3,})(?<value>[\s\S]+?)(?=\n\s*\n|$)`,

	// inlines
	codespan: String.raw`(?:(?<!\\)(?<ticks>(?:\`))(?![\s\`]*\k<ticks>)(?<text>.+?)(?<!\\)\k<ticks>)`,
	// boldItalic: String.raw`(?:(?<!\\)(?<marks>(?:\*|_){3})(?!(?:[\s*_]+\k<marks>)|[*_]+?)(?<text>.+?)(?<!\\)\k<marks>)`,
	// bold: String.raw`(?:(?<!\\)(?<marks>(?:\*|_){2})(?!(?:[\s*]+\k<marks>)|[*_]+?)(?<text>.+?)(?<!\\)\k<marks>)`,
	// italic: String.raw`(?:(?<!\\)(?<marks>(?:\*|_))(?!(?:[\s*]+\k<marks>)|[*_]+?)(?<text>.+?)(?<!\\)\k<marks>)`,
	marks: String.raw`(?<!\\)(?:(?:(?<!(^\s*)|[*_]+\s*)[*_]{1,3})|(?:(?<marks>[*_]{1,3})(?!\s*[*_]+|\s*$)))`,
};

class Token {
	static allBlockReg: RegExp;
	static allInlineReg: RegExp;
	// static boldReg: RegExp;
	// static italicReg: RegExp;

	type: string = "token";
	start: number;
	end: number;
	value: string;
	tokens: Token[] = [];

	get length() {
		return this.end - this.start;
	}

	constructor(start: number, end: number, value: string) {
		this.start = start;
		this.end = end;
		this.value = value;
	}

	render(): string {
		let html = "";
		for (const token of this.tokens) {
			html += token.render();
		}
		return html;
	}

	_parse(): boolean {
		return true;
	}

	_parseInline() {
		let preTokenEnd = this.start;
		let inlinePreTokenEnd = 0;
		let matches = this.value.matchAll(Token.allInlineReg);
		for (const match of matches) {
			let { text, ticks, marks } = match.groups!;

			let start = this.start + match.index;
			let end = start + match[0].length;
			let inlineStart = match.index;
			let inlineEnd = inlineStart + match[0].length;
			let markedText = new MarkedText();

			if (preTokenEnd < start) {
				let token = new TextToken(
					preTokenEnd,
					start,
					this.value.substring(inlinePreTokenEnd, inlineEnd),
				);
				if (markedText.marked) {
					markedText.addText(token);
				} else {
					this.tokens.push(token);
				}
			}

			if (marks) {
				markedText.addMark(new TextToken(start, start + marks.length, marks));
				markedText.addText(
					new TextToken(start + marks.length, end - marks.length, text),
				);
				markedText.addMark(new TextToken(end - marks.length, end, marks));
			} else if (ticks) {
				let token = new CodeSpan(start, end, ticks, text, match[0]);
				if (markedText.marked) {
					markedText.addText(token);
				} else {
					this.tokens.push(token);
				}
			}

			preTokenEnd = end;
			inlinePreTokenEnd = inlineEnd;
		}

		if (preTokenEnd < this.end || this.tokens.length == 0) {
			this.tokens.push(
				new TextToken(
					preTokenEnd,
					this.end,
					this.value.substring(inlinePreTokenEnd, this.value.length),
				),
			);
		}
	}
}

Token.allBlockReg = new RegExp([Regex.heading, Regex.code].join("|"), "gm");
Token.allInlineReg = new RegExp([Regex.codespan, Regex.marks].join("|"), "gm");
// Token.boldReg = new RegExp(Regex.bold, "gm");
// Token.italicReg = new RegExp(Regex.italic, "gm");

export class MarkDoc extends Token {
	constructor(text: string) {
		super(0, text.length, text);
		this.type = "root";
		this._parse();
	}

	_parse(): boolean {
		let preTokenEnd = 0;
		let matches = this.value.matchAll(Token.allBlockReg);

		for (const match of matches) {
			let { text, hashes, lines, fence, lang } = match.groups ?? {};
			let start = match.index;
			let end = match.index + match[0].length;

			if (preTokenEnd < start) {
				this.tokens.push(
					new Paragraph(
						preTokenEnd,
						start,
						this.value.substring(preTokenEnd, start),
					),
				);
			}

			if (hashes || lines) {
				this.tokens.push(
					new Heading(start, end, hashes, text, lines, match[0]),
				);
			} else if (fence) {
				this.tokens.push(
					new CodeBlock(start, end, fence, lang, text, match[0]),
				);
			}

			// console.log(match);
			preTokenEnd = end;
		}

		if (preTokenEnd < this.end || this.tokens.length == 0) {
			this.tokens.push(
				new Paragraph(
					preTokenEnd,
					this.end,
					this.value.substring(preTokenEnd, this.end),
				),
			);
		}

		return true;
	}
}

class Heading extends Token {
	depth: number;
	hashes: TextToken | undefined;
	lines: TextToken | undefined;

	constructor(
		start: number,
		end: number,
		hashes: string | undefined,
		text: string,
		lines: string | undefined,
		value: string,
	) {
		super(start, end, value);
		this.type = "heading";
		if (hashes) {
			this.hashes = new TextToken(start, hashes.length - 1, hashes);
			this.depth = hashes.length - 1;
		} else if (lines) {
			this.lines = new TextToken(end - lines.length, end, lines);
			if (lines.at(0) == "=") this.depth = 1;
			else this.depth = 2;
		} else {
			this.depth = 1;
		}

		this._parseInline();

		// this.tokens.push(new TextToken(start, end, text));
	}

	render(): string {
		let html = super.render();
		return `<h${this.depth}>${this.hashes?.value ?? ""}${html}${this.lines?.value ?? ""}</h${this.depth}>`;
	}
}

class CodeBlock extends Token {
	fenceStart: TextToken;
	lang: TextToken | undefined;
	fenceEnd: TextToken;

	constructor(
		start: number,
		end: number,
		fence: string,
		lang: string | undefined,
		text: string,
		value: string,
	) {
		super(start, end, value);
		this.type = "codeBlock";

		this.fenceStart = new TextToken(start, start + fence.length, fence);
		this.fenceEnd = new TextToken(end - fence.length, end, fence);
		if (lang) {
			this.lang = new TextToken(
				start,
				start + fence.length + lang.length,
				lang,
			);
			this.tokens.push(
				new TextToken(
					start + fence.length + lang.length,
					end - fence.length,
					text,
				),
			);
		} else {
			this.tokens.push(
				new TextToken(start + fence.length, end - fence.length, text),
			);
		}
	}

	render(): string {
		let html = super.render();
		if (this.lang) {
			return `<code><span class="hidden">${this.fenceStart.value}</span><span class="code-lang">${this.lang.value}</span>${html}<span class="hidden">${this.fenceEnd.value}</span><code>`;
		} else {
			return `<code><span class="hidden">${this.fenceStart.value}</span>${html}<span class="hidden">${this.fenceEnd.value}</span><code>`;
		}
	}
}

class Paragraph extends Token {
	constructor(start: number, end: number, value: string) {
		super(start, end, value);
		this.type = "paragraph";
		this._parseInline();
	}

	render(): string {
		let html = super.render();
		return `<p>${html}</p>`;
	}
}

class MarkedText {
	types: { [key: number]: { marked: boolean; index: number } } = {
		3: { marked: false, index: Number.POSITIVE_INFINITY },
		2: { marked: false, index: Number.POSITIVE_INFINITY },
		1: { marked: false, index: Number.POSITIVE_INFINITY },
	};
	tokens: Token[] = [];

	get marked(): boolean {
		return this.types[3].marked || this.types[2].marked || this.types[1].marked;
	}

	get nextMark(): number | undefined {
		let i3 = this.types[3].index;
		let i2 = this.types[2].index;
		let i1 = this.types[1].index;
		if (i3 < i2 && i3 < i1) {
			return 3;
		} else if (i2 < i3 && i2 < i1) {
			return 2;
		} else if (i1 < i3 && i1 < i2) {
			return 1;
		} else {
			return undefined;
		}
	}

	addMark(mark: TextToken): Token[] {
		let type = mark.value.length;
		if (this.types[type].marked) {
			this.tokens.push(mark);
			let token = this._parse(type, this.tokens.length);
			return token ? [token] : [];
		} else {
			this.types[type].marked = true;
			this.tokens.push(mark);
			this.types[type].index = this.tokens.length - 1;
			return [];
		}
	}

	addText(text: Token) {
		this.tokens.push(text);
	}

	_splitToken(arrayIndex: number, insideIndex: number): [Token, Token] {
		let token = this.tokens[arrayIndex];
		let cut = new TextToken(
			token.start + insideIndex,
			token.end,
			token.value.substring(insideIndex),
		);
		token.value = token.value.substring(0, insideIndex);
		token.end = token.end - cut.length;
		this.tokens.splice(arrayIndex + 1, 0, cut);
		return [token, cut];
	}

	_parse(
		type: number,
		endIndex: number,
		shouldYield: boolean = true,
	): Token | undefined {
		let startIndex = this.types[type].index;
		let startMarks = this.tokens.splice(startIndex, startIndex + 1)[0];
		let endMarks = this.tokens.splice(endIndex - 1, endIndex)[0];
		let token = new FancyText(startMarks.start, endMarks.end, null, null, null);
		token.startMarks = startMarks;
		token.endMarks = endMarks;
		let children = this.tokens.splice(startIndex + 1, endIndex - 1);
		endIndex - children.length - 1;
		for (const child of children) {
			let preChild = token.tokens.at(-1);
			if (preChild && preChild.type == "text" && child.type == "text") {
				preChild.value += child.value;
				token.value += child.value;
				preChild.end = child.end;
			} else {
				token.tokens.push(child);
				token.value += child.value;
			}
		}
		let shouldYieldCheck = this._shouldYieldAfterParsing(type);
		this.types[type].marked = false;
		this.types[type].index = Number.POSITIVE_INFINITY;
		if (shouldYieldCheck && this.tokens.length == 0 && shouldYield) {
			return token;
		} else {
			this.tokens.splice(endIndex, 0, token);
			return undefined;
		}
	}

	_shouldYieldAfterParsing(type: number) {
		if (type == 3) {
			this.types[2].marked = false;
			this.types[2].index = Number.POSITIVE_INFINITY;
			this.types[1].marked = false;
			this.types[1].index = Number.POSITIVE_INFINITY;
			return true;
		} else if (type == 2) {
			if (this.types[3].marked) {
				if (this.types[3].index < this.types[2].index) {
					return false;
				} else {
					this.types[3].marked = false;
					this.types[3].index = Number.POSITIVE_INFINITY;
					return true;
				}
			} else if (this.types[1].marked) {
				if (this.types[1].index < this.types[2].index) {
					return false;
				} else {
					this.types[1].marked = false;
					this.types[1].index = Number.POSITIVE_INFINITY;
					return false;
				}
			} else {
				return true;
			}
		} else {
			if (this.types[3].marked) {
				if (this.types[3].index < this.types[1].index) {
					return false;
				} else {
					this.types[3].marked = false;
					this.types[3].index = Number.POSITIVE_INFINITY;
					return true;
				}
			} else if (this.types[2].marked) {
				if (this.types[2].index < this.types[1].index) {
					return false;
				} else {
					this.types[2].marked = false;
					this.types[2].index = Number.POSITIVE_INFINITY;
					return true;
				}
			} else {
				return true;
			}
		}
	}

	finish(): Token[] {
		let next = this.nextMark;
		if (next) {
			if (next == 3) {
				if (this.types[2].marked) {
					// Parse a bold token
					let endBoldIndex = this.types[2].index;
					if (this.types[1].marked) {
						// Parse an italic token too
						let endItalicIndex = this.types[1].index;
						if (endItalicIndex < endBoldIndex) {
							// Bold starts first
							this._splitToken(this.types[3].index, 2);
							this.types[2].index = this.types[3].index;
							this.types[1].index = this.types[3].index + 1;
							this.types[3].marked = false;
							this.types[3].index = Number.POSITIVE_INFINITY;
							this._parse(1, endItalicIndex, false);
							this._parse(2, endBoldIndex, false);
						} else {
							// Italic starts first
							this._splitToken(this.types[3].index, 1);
							this.types[1].index = this.types[3].index;
							this.types[2].index = this.types[3].index + 1;
							this.types[3].marked = false;
							this.types[3].index = Number.POSITIVE_INFINITY;
							this._parse(2, endBoldIndex, false);
							this._parse(1, endItalicIndex, false);
						}
					} else {
						// Only Parse Bold, count second two chars as beginning
						this._splitToken(this.types[3].index, 1);
						this.types[2].index = this.types[3].index + 1;
						this.types[3].marked = false;
						this.types[3].index = Number.POSITIVE_INFINITY;
						this._parse(2, endBoldIndex, false);
					}
				} else if (this.types[1].marked) {
					// Only Parse Italics, count last char as beginning
					let endItalicIndex = this.types[1].index;
					this._splitToken(this.types[3].index, 2);
					this.types[1].index = this.types[3].index + 1;
					this.types[3].marked = false;
					this.types[3].index = Number.POSITIVE_INFINITY;
					this._parse(1, endItalicIndex, false);
				}
			} else if (next == 2) {
				if (this.types[3].marked) {
					// Parse a bold token
					if (this.types[1].marked) {
						// Parse a bold and italic token
						if (this.types[1].index < this.types[3].index) {
							// Italic is inside a part of bold
							this._splitToken(this.types[3].index, 1);
							let endBoldIndex = this.types[3].index + 1;
							let endItalicIndex = this.types[3].index;
							this.types[3].marked = false;
							this.types[3].index = Number.POSITIVE_INFINITY;
							this._parse(1, endItalicIndex, false);
							this._parse(2, endBoldIndex, false);
						} else {
							// Italic is on the other side of bold
							this._splitToken(this.types[3].index, 2);
							let endBoldIndex = this.types[3].index;
							let endItalicIndex = this.types[3].index + 1;
							this.types[3].marked = false;
							this.types[3].index = Number.POSITIVE_INFINITY;
							this._parse(2, endBoldIndex, false);
							this._parse(1, endItalicIndex, false);
						}
					} else {
						this._splitToken(this.types[3].index, 2);
						let endBoldIndex = this.types[3].index;
						this.types[3].marked = false;
						this.types[3].index = Number.POSITIVE_INFINITY;
						this._parse(2, endBoldIndex, false);
					}
				}
			} else {
				if (this.types[3].marked) {
					// Parse an italic token
					if (this.types[2].marked) {
						// Parse a bold and italic
						if (this.types[2].index < this.types[3].index) {
							// Bold is inside italic
							this._splitToken(this.types[3].index, 2);
							let endBoldIndex = this.types[3].index;
							let endItalicIndex = this.types[3].index + 1;
							this.types[3].marked = false;
							this.types[3].index = Number.POSITIVE_INFINITY;
							this._parse(2, endBoldIndex, false);
							this._parse(1, endItalicIndex, false);
						} else {
							// Bold is on the other side of italic
							this._splitToken(this.types[3].index, 1);
							let endBoldIndex = this.types[3].index + 1;
							let endItalicIndex = this.types[3].index;
							this.types[3].marked = false;
							this.types[3].index = Number.POSITIVE_INFINITY;
							this._parse(1, endItalicIndex, false);
							this._parse(2, endBoldIndex, false);
						}
					} else {
						this._splitToken(this.types[3].index, 1);
						let endItalicIndex = this.types[3].index;
						this.types[3].marked = false;
						this.types[3].index = Number.POSITIVE_INFINITY;
						this._parse(1, endItalicIndex, false);
					}
				}
			}
			if (this.tokens.length > 1) {
				for (const [index, token] of this.tokens.entries()) {
					let preToken = this.tokens[index - 1];
					if (preToken && preToken.type == "text" && token.type == "text") {
						token.value = preToken.value + token.value;
						token.start = preToken.start;
					}
				}
			}
			return this.tokens;
		} else {
			return [];
		}
	}
}

class FancyText extends Token {
	startMarks: TextToken = new TextToken(0, 0, "***");
	endMarks: TextToken = new TextToken(0, 0, "***");

	constructor(
		start: number,
		end: number,
		marks: string | null,
		text: string | null,
		value: string | null,
	) {
		super(start, end, value ?? "");
		this.type = "fancyText";
		if (marks && text) {
			this.startMarks = new TextToken(start, start + marks.length, marks);
			this.endMarks = new TextToken(end - marks.length, end, marks);
			this.tokens.push(
				new TextToken(start + marks.length, end - marks.length, text),
			);
		}
	}

	render(): string {
		let html = super.render();
		let base = `<span class="hidden">${this.startMarks.value}</span>${html}<span class="hidden">${this.endMarks.value}</span>`;
		if (this.startMarks.length == 3) {
			return `<strong><em>${base}</em></strong>`;
		} else if (this.startMarks.length == 2) {
			return `<strong>${base}</strong>`;
		} else {
			return `<em>${base}</em>`;
		}
	}
}

class BoldItalic extends Token {
	marksStart: TextToken;
	marksEnd: TextToken;

	constructor(
		start: number,
		end: number,
		marks: string,
		text: string,
		value: string,
	) {
		super(start, end, value);
		this.type = "boldItalic";
		this.marksStart = new TextToken(start, start + marks.length, marks);
		this.marksEnd = new TextToken(end - marks.length, end, marks);
		this.tokens.push(
			new TextToken(start + marks.length, end - marks.length, text),
		);
	}

	render(): string {
		let html = super.render();
		return `<strong><em><span class="hidden">${this.marksStart.value}</span>${html}<span class="hidden">${this.marksEnd.value}</span></em></strong>`;
	}
}

class Bold extends Token {
	marksStart: TextToken;
	marksEnd: TextToken;

	constructor(
		start: number,
		end: number,
		marks: string,
		text: string,
		value: string,
	) {
		super(start, end, value);
		this.type = "bold";
		this.marksStart = new TextToken(start, start + marks.length, marks);
		this.marksEnd = new TextToken(end - marks.length, end, marks);
		this.tokens.push(
			new TextToken(start + marks.length, end - marks.length, text),
		);
	}

	render(): string {
		let html = super.render();
		return `<strong><span class="hidden">${this.marksStart.value}</span>${html}<span class="hidden">${this.marksEnd.value}</span></strong>`;
	}
}

class Italic extends Token {
	marksStart: TextToken;
	marksEnd: TextToken;

	constructor(
		start: number,
		end: number,
		marks: string,
		text: string,
		value: string,
	) {
		super(start, end, value);
		this.type = "italic";
		this.marksStart = new TextToken(start, start + marks.length, marks);
		this.marksEnd = new TextToken(end - marks.length, end, marks);
		this.tokens.push(
			new TextToken(start + marks.length, end - marks.length, text),
		);
	}

	render(): string {
		let html = super.render();
		return `<em><span class="hidden">${this.marksStart.value}</span>${html}<span class="hidden">${this.marksEnd.value}</span></em>`;
	}
}

class CodeSpan extends Token {
	ticksStart: TextToken;
	ticksEnd: TextToken;

	constructor(
		start: number,
		end: number,
		ticks: string,
		text: string,
		value: string,
	) {
		super(start, end, value);
		this.type = "codespan";
		this.ticksStart = new TextToken(start, start + ticks.length, ticks);
		this.ticksEnd = new TextToken(end - ticks.length, end, ticks);
		this.tokens.push(
			new TextToken(start + ticks.length, end - ticks.length, text),
		);
	}

	render(): string {
		let html = super.render();
		return `<code><span class="hidden">${this.ticksStart.value}</span>${html}<span class="hidden">${this.ticksEnd.value}</span></code>`;
	}
}

class TextToken extends Token {
	constructor(start: number, end: number, value: string) {
		super(start, end, value);
		this.type = "text";
	}

	render() {
		return this.value;
	}
}

// let markdown = "## Jotter!".repeat(1);

// let perfStart = performance.now();
// let doc = new MarkDoc(markdown);
// let perfEnd = performance.now();

// let perf = perfEnd - perfStart;
// console.log(doc.render());
// console.log(markdown.length.toLocaleString());
// console.log(`${perf.toFixed(2)}ms`);
