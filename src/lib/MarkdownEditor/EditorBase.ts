export class TokenSchema {
	regex: RegExp;
	token: typeof ParsedToken;

	constructor(regex: RegExp, token: typeof ParsedToken) {
		this.regex = regex;
		this.token = token;
	}
}

export class TokenMaker {
	marker: string = "";
	start: number = 0;
	possible: boolean = false;
	markersFound: number = 0;
	foundMarker(index: number) {}
	next(char: string, index: number): { continue: boolean; isToken: boolean } {
		return { continue: false, isToken: false };
	}
	reset() {}
}

export class Token {
	static blockSchemas: TokenSchema[] = [];
	static #inlineSchemas: TokenSchema[] = [];
	static #matcher: Map<string, TokenMaker> = new Map();

	static addBlockSchema(schema: TokenSchema) {
		Token.blockSchemas.push(schema);
	}
	static addInlineSchema(schema: TokenSchema) {
		Token.#inlineSchemas.push(schema);
	}

	static addMaker(maker: TokenMaker) {
		for (const marker of maker.marker) Token.#matcher.set(marker, maker);
	}

	// static regex = {
	// 	block: {
	// 		heading: String.raw`(?:^(?<hashes>#{1,6} )(?<text>.*)|(?<text>.+\n)(?<lines>(?:=+|-+)))\n?`,
	// 		code: String.raw`(?:(?<!\\)(?<fence>(?:\`|~){3})(?!(?:[ \t\`~]*\k<fence>)|[\`~]+?)(?<lang>[^\s\`~]*)(?<text>[\s\S]*?)(?<!\\)\k<fence>)`,
	// 		// paragraph: String.raw`(?:\r?\n|^)(?![#>-]|\s*[*+-]|\s*\d+\.|\`{3,}|~{3,})(?<value>[\s\S]+?)(?=\n\s*\n|$)`,
	// 	},

	// 	inline: {
	// 		codespan: String.raw`(?:(?<!\\)(?<ticks>(?:\`))(?![\s\`]*\k<ticks>)(?<text>.+?)(?<!\\)\k<ticks>)`,
	// 		marks: String.raw`(?<!\\)(?:(?<!(^\s*)|[*_\n]+\s*)(?<marks>[*_]{1,3})|(?<marks>[*_]{1,3})(?!\s*[*_\n]+|\s*$))`,
	// 		// boldItalic: String.raw`(?:(?<!\\)(?<marks>(?:\*|_){3})(?!(?:[\s*_]+\k<marks>)|[*_]+?)(?<text>.+?)(?<!\\)\k<marks>)`,
	// 		// bold: String.raw`(?:(?<!\\)(?<marks>(?:\*|_){2})(?!(?:[\s*]+\k<marks>)|[*_]+?)(?<text>.+?)(?<!\\)\k<marks>)`,
	// 		// italic: String.raw`(?:(?<!\\)(?<marks>(?:\*|_))(?!(?:[\s*]+\k<marks>)|[*_]+?)(?<text>.+?)(?<!\\)\k<marks>)`,
	// 	},
	// };
	static blockRegex: RegExp;
	static inlineRegex: RegExp;

	name: string = "token";
	start: number;
	value: string;
	tokens: Token[] = [];

	get end(): number {
		return this.start + this.value.length;
	}

	get length() {
		return this.value.length;
	}

	constructor(start: number, value: string) {
		this.start = start;
		this.value = value;
	}

	textifyChildren() {
		if (this.tokens.length == 1 && this.tokens[0].name != "text") {
			let token = this.tokens.pop()!;
			let child = new TextToken(token.start, token.value);
			this.tokens.push(child);
		} else if (this.tokens.length > 1) {
			let child = new TextToken(this.tokens[0].start, "");
			for (const token of this.tokens) {
				child.value += token.value;
			}
			this.tokens = [child];
		}
	}

	parse(match?: RegExpExecArray): boolean {
		for (const schema of Token.blockSchemas) {
			let matches = this.value.matchAll(schema.regex);
			for (const match of matches) {
				let start = match.index;
				this.tokens.push(new schema.token(start, match));
			}
		}
		this.tokens.sort((a, b) => a.start - b.start);

		// if (Token.#matcher.size > 0) {
		// 	let value = this.value;
		// 	let possible: TokenMaker[] = [];
		// 	let moveToPossible = false;
		// 	let currentMaker: TokenMaker | undefined;
		// 	for (let i = 0; i < this.value.length; i++) {
		// 		if (currentMaker) {
		// 			let res = currentMaker.next(value[i], i);
		// 			if (!res.continue) {
		// 				this.tokens.push(
		// 					new TextToken(
		// 						currentMaker.start,
		// 						value.substring(currentMaker.start, i + 1),
		// 					),
		// 				);
		// 				currentMaker.reset();
		// 				Token.addMaker(currentMaker);
		// 				currentMaker = undefined;
		// 			}
		// 		} else {
		// 			if (Token.#matcher.has(value[i])) {
		// 				let maker = Token.#matcher.get(value[i])!;
		// 				maker.foundMarker(i);
		// 				moveToPossible = true;
		// 			}
		// 			for (const [pi, maker] of possible.entries()) {
		// 				let res = maker.next(value[i], i);
		// 				if (res.continue) {
		// 					if (res.isToken) {
		// 						currentMaker = maker;
		// 						possible.splice(pi, 1);
		// 					}
		// 				} else if (res.isToken) {
		// 					this.tokens.push(
		// 						new TextToken(maker.start, value.substring(maker.start, i + 1)),
		// 					);
		// 					maker.reset();
		// 					Token.#matcher.set(value[i], maker);
		// 					possible.splice(pi, 1);
		// 				}
		// 			}
		// 		}
		// 		if (moveToPossible) {
		// 			possible.push(Token.#matcher.get(value[i])!);
		// 			Token.#matcher.delete(value[i]);
		// 			moveToPossible = false;
		// 		}
		// 	}

		// 	if (currentMaker) {
		// 		this.tokens.push(
		// 			new TextToken(
		// 				currentMaker.start,
		// 				value.substring(currentMaker.start, value.length),
		// 			),
		// 		);
		// 	}
		// }

		return true;
	}

	// parseInline() {
	// 	this.textifyChildren();
	// 	let inlineToken = this.tokens[0];
	// 	if (inlineToken) {
	// 		let inlineText = inlineToken.value;
	// 		let preTokenEnd = inlineToken.start;
	// 		let inlinePreTokenEnd = 0;
	// 		let matches = Array.from(inlineText.matchAll(Token.inlineRegex));
	// 		if (matches.length > 0) this.tokens = [];
	// 		let markedText = new MarkedText();
	// 		for (const match of matches) {
	// 			let { text, ticks, marks } = match.groups!;

	// 			let start = inlineToken.start + match.index;
	// 			let end = start + match[0].length;
	// 			let inlineStart = match.index;
	// 			let inlineEnd = inlineStart + match[0].length;

	// 			let tokenSpan: Token[] = [];

	// 			if (inlinePreTokenEnd < inlineStart) {
	// 				let token = new TextToken(
	// 					preTokenEnd,
	// 					inlineText.substring(inlinePreTokenEnd, inlineStart),
	// 				);
	// 				if (markedText.marked) {
	// 					markedText.addText(token);
	// 				} else {
	// 					tokenSpan.push(token);
	// 				}
	// 			}

	// 			if (marks) {
	// 				tokenSpan.push(...markedText.addMark(new TextToken(start, marks)));
	// 			} else if (ticks) {
	// 				let token = new CodeSpan(start, end, ticks, text, match[0]);
	// 				if (markedText.marked) {
	// 					markedText.addText(token);
	// 				} else {
	// 					tokenSpan.push(token);
	// 				}
	// 			}

	// 			this.tokens.push(...tokenSpan);
	// 			preTokenEnd = tokenSpan[tokenSpan.length - 1].end;
	// 			inlinePreTokenEnd = inlineEnd;
	// 			console.log(tokenSpan);
	// 		}

	// 		// this.tokens.push(...markedText.finish());

	// 		if (inlinePreTokenEnd > 0 && inlinePreTokenEnd < inlineToken.end) {
	// 			this.tokens.push(
	// 				new TextToken(
	// 					preTokenEnd,
	// 					inlineText.substring(inlinePreTokenEnd, inlineToken.end),
	// 				),
	// 			);
	// 		}
	// 	}
	// }

	render(): string {
		let html: string;
		if (this.tokens.length > 0) {
			html = "";
			for (const token of this.tokens) {
				html += token.render();
			}
		} else {
			html = this.value;
		}
		return html;
	}

	toString(depth: number = 0, extras?: string[]): string {
		if (this.tokens.length > 0) {
			// let children = "";
			let children: string[] = [];
			let spaces = " ".repeat(depth * 2);
			for (const child of this.tokens) {
				// children += `${extras ? spaces + "    " : spaces + "  "}${child.toString(depth + 1)}`;
				children.push(
					`${extras ? spaces + "    " : spaces + "  "}${child.toString(depth + 1)}`,
				);
			}
			let extrasString = "";
			if (extras) {
				extrasString += `\n${spaces + "  "}`;
				for (const extra of extras) {
					extrasString += `${extra}\n${spaces + "  "}`;
				}
			}
			return `${this.name[0].toUpperCase() + this.name.substring(1)}(${this.start}, ${extrasString}[\n${children.join(",\n")}\n${extras ? spaces + "  " : spaces}]${extras ? "\n" + spaces : ""})`;
		} else {
			return `${this.name[0].toUpperCase() + this.name.substring(1)}(${this.start}, ${JSON.stringify(this.value)})`;
		}
	}
}

export class Doc extends Token {
	constructor(text: string) {
		super(0, text);
		this.name = "root";

		// let blockRegex = "";
		// for (const reg of Object.entries(Token.regex.block)) {
		// 	blockRegex += reg[1] + "|";
		// }
		// blockRegex = blockRegex.slice(0, -1);
		// let inlineRegex = "";
		// for (const reg of Object.entries(Token.regex.inline)) {
		// 	inlineRegex += reg[1] + "|";
		// }
		// inlineRegex = inlineRegex.slice(0, -1);
		// Token.blockRegex = new RegExp(blockRegex, "gm");
		// Token.inlineRegex = new RegExp(inlineRegex, "gm");

		this.parse();
	}

	// 	parse(match?: RegExpExecArray): boolean {
	// 		let preTokenEnd = 0;
	// 		let matches = this.value.matchAll(Token.blockRegex);

	// 		for (const match of matches) {
	// 			let { text, hashes, lines, fence, lang } = match.groups ?? {};
	// 			let start = match.index;
	// 			let end = match.index + match[0].length;

	// 			if (preTokenEnd < start) {
	// 				this.tokens.push(
	// 					new Paragraph(preTokenEnd, this.value.substring(preTokenEnd, start)),
	// 				);
	// 			}

	// 			if (hashes || lines) {
	// 				this.tokens.push(new Heading(start, match));
	// 			} else if (fence) {
	// 				this.tokens.push(new CodeBlock(start, fence, lang, text, match[0]));
	// 			}

	// 			preTokenEnd = end;
	// 		}

	// 		if (preTokenEnd < this.end) {
	// 			this.tokens.push(
	// 				new Paragraph(preTokenEnd, this.value.substring(preTokenEnd, this.end)),
	// 			);
	// 		}
	// 		return true;
	// 	}
}

export class ParsedToken extends Token {
	constructor(start: number, match: RegExpExecArray) {
		super(start, match[0]);
	}
}

class Paragraph extends Token {
	constructor(start: number, value: string) {
		super(start, value);
		this.name = "paragraph";
		this.tokens.push(new TextToken(start, value));
		// this.parseInline();
	}

	render(): string {
		let html = super.render();
		return `<p>${html}</p>`;
	}
}

class FancyText extends Token {
	startMarks: TextToken = new TextToken(0, "***");
	endMarks: TextToken = new TextToken(0, "***");

	constructor(
		start: number,
		marks: string | null,
		text: string | null,
		value: string | null,
	) {
		super(start, value ?? "");
		this.name = "fancyText";
		if (marks && text) {
			this.startMarks = new TextToken(start, marks);
			this.endMarks = new TextToken(this.end - marks.length, marks);
			this.tokens.push(new TextToken(start + marks.length, text));
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

	constructor(start: number, marks: string, text: string, value: string) {
		super(start, value);
		this.name = "boldItalic";
		this.marksStart = new TextToken(start, marks);
		this.marksEnd = new TextToken(this.end - marks.length, marks);
		this.tokens.push(new TextToken(start + marks.length, text));
	}

	render(): string {
		let html = super.render();
		return `<strong><em><span class="hidden">${this.marksStart.value}</span>${html}<span class="hidden">${this.marksEnd.value}</span></em></strong>`;
	}
}

class Bold extends Token {
	marksStart: TextToken;
	marksEnd: TextToken;

	constructor(start: number, marks: string, text: string, value: string) {
		super(start, value);
		this.name = "bold";
		this.marksStart = new TextToken(start, marks);
		this.marksEnd = new TextToken(this.end - marks.length, marks);
		this.tokens.push(new TextToken(start + marks.length, text));
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
		super(start, value);
		this.name = "italic";
		this.marksStart = new TextToken(start, marks);
		this.marksEnd = new TextToken(end - marks.length, marks);
		this.tokens.push(new TextToken(start + marks.length, text));
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
		super(start, value);
		this.name = "codespan";
		this.ticksStart = new TextToken(start, ticks);
		this.ticksEnd = new TextToken(end - ticks.length, ticks);
		this.tokens.push(new TextToken(start + ticks.length, text));
	}

	render(): string {
		let html = super.render();
		return `<code><span class="hidden">${this.ticksStart.value}</span>${html}<span class="hidden">${this.ticksEnd.value}</span></code>`;
	}
}

export class TextToken extends Token {
	constructor(start: number, value: string) {
		super(start, value);
		this.name = "text";
	}
}

// class MarkedText {
// 	types: { [key: number]: { marked: boolean; index: number } } = {
// 		3: { marked: false, index: Number.POSITIVE_INFINITY },
// 		2: { marked: false, index: Number.POSITIVE_INFINITY },
// 		1: { marked: false, index: Number.POSITIVE_INFINITY },
// 	};
// 	tokens: Token[] = [];

// 	get marked(): boolean {
// 		return this.types[3].marked || this.types[2].marked || this.types[1].marked;
// 	}

// 	get nextMark(): number | undefined {
// 		let i3 = this.types[3].index;
// 		let i2 = this.types[2].index;
// 		let i1 = this.types[1].index;
// 		if (i3 < i2 && i3 < i1) {
// 			return 3;
// 		} else if (i2 < i3 && i2 < i1) {
// 			return 2;
// 		} else if (i1 < i3 && i1 < i2) {
// 			return 1;
// 		} else {
// 			return undefined;
// 		}
// 	}

// 	addMark(mark: TextToken): Token[] {
// 		let type = mark.value.length;
// 		if (this.types[type].marked) {
// 			this.tokens.push(mark);
// 			let token = this._parse(type, this.tokens.length);
// 			return token ? [token] : [];
// 		} else {
// 			this.types[type].marked = true;
// 			this.tokens.push(mark);
// 			this.types[type].index = this.tokens.length - 1;
// 			return [];
// 		}
// 	}

// 	addText(text: Token) {
// 		this.tokens.push(text);
// 	}

// 	_splitToken(arrayIndex: number, insideIndex: number): [Token, Token] {
// 		let token = this.tokens[arrayIndex];
// 		let cut = new TextToken(
// 			token.start + insideIndex,
// 			token.value.substring(insideIndex),
// 		);
// 		token.value = token.value.substring(0, insideIndex);
// 		this.tokens.splice(arrayIndex + 1, 0, cut);
// 		return [token, cut];
// 	}

// 	_parse(
// 		type: number,
// 		endIndex: number,
// 		shouldYield: boolean = true,
// 	): Token | undefined {
// 		let startIndex = this.types[type].index;
// 		let startMarks = this.tokens.splice(startIndex, startIndex + 1)[0];
// 		let endMarks = this.tokens.splice(endIndex - 1, endIndex)[0];
// 		let token = new FancyText(startMarks.start, null, null, null);
// 		token.startMarks = startMarks;
// 		token.endMarks = endMarks;
// 		let children = this.tokens.splice(startIndex + 1, endIndex - 1);
// 		endIndex - children.length - 1;
// 		for (const child of children) {
// 			let preChild = token.tokens.at(-1);
// 			if (preChild && preChild.name == "text" && child.name == "text") {
// 				preChild.value += child.value;
// 				token.value += child.value;
// 			} else {
// 				token.tokens.push(child);
// 				token.value += child.value;
// 			}
// 		}
// 		let shouldYieldCheck = this._shouldYieldAfterParsing(type);
// 		this.types[type].marked = false;
// 		this.types[type].index = Number.POSITIVE_INFINITY;
// 		if (shouldYieldCheck && this.tokens.length == 0 && shouldYield) {
// 			return token;
// 		} else {
// 			this.tokens.splice(endIndex, 0, token);
// 			return undefined;
// 		}
// 	}

// 	_shouldYieldAfterParsing(type: number) {
// 		if (type == 3) {
// 			this.types[2].marked = false;
// 			this.types[2].index = Number.POSITIVE_INFINITY;
// 			this.types[1].marked = false;
// 			this.types[1].index = Number.POSITIVE_INFINITY;
// 			return true;
// 		} else if (type == 2) {
// 			if (this.types[3].marked) {
// 				if (this.types[3].index < this.types[2].index) {
// 					return false;
// 				} else {
// 					this.types[3].marked = false;
// 					this.types[3].index = Number.POSITIVE_INFINITY;
// 					return true;
// 				}
// 			} else if (this.types[1].marked) {
// 				if (this.types[1].index < this.types[2].index) {
// 					return false;
// 				} else {
// 					this.types[1].marked = false;
// 					this.types[1].index = Number.POSITIVE_INFINITY;
// 					return false;
// 				}
// 			} else {
// 				return true;
// 			}
// 		} else {
// 			if (this.types[3].marked) {
// 				if (this.types[3].index < this.types[1].index) {
// 					return false;
// 				} else {
// 					this.types[3].marked = false;
// 					this.types[3].index = Number.POSITIVE_INFINITY;
// 					return true;
// 				}
// 			} else if (this.types[2].marked) {
// 				if (this.types[2].index < this.types[1].index) {
// 					return false;
// 				} else {
// 					this.types[2].marked = false;
// 					this.types[2].index = Number.POSITIVE_INFINITY;
// 					return true;
// 				}
// 			} else {
// 				return true;
// 			}
// 		}
// 	}

// 	finish(): Token[] {
// 		let next = this.nextMark;
// 		if (next) {
// 			if (next == 3) {
// 				if (this.types[2].marked) {
// 					// Parse a bold token
// 					let endBoldIndex = this.types[2].index;
// 					if (this.types[1].marked) {
// 						// Parse an italic token too
// 						let endItalicIndex = this.types[1].index;
// 						if (endItalicIndex < endBoldIndex) {
// 							// Bold starts first
// 							this._splitToken(this.types[3].index, 2);
// 							this.types[2].index = this.types[3].index;
// 							this.types[1].index = this.types[3].index + 1;
// 							this.types[3].marked = false;
// 							this.types[3].index = Number.POSITIVE_INFINITY;
// 							this._parse(1, endItalicIndex, false);
// 							this._parse(2, endBoldIndex, false);
// 						} else {
// 							// Italic starts first
// 							this._splitToken(this.types[3].index, 1);
// 							this.types[1].index = this.types[3].index;
// 							this.types[2].index = this.types[3].index + 1;
// 							this.types[3].marked = false;
// 							this.types[3].index = Number.POSITIVE_INFINITY;
// 							this._parse(2, endBoldIndex, false);
// 							this._parse(1, endItalicIndex, false);
// 						}
// 					} else {
// 						// Only Parse Bold, count second two chars as beginning
// 						this._splitToken(this.types[3].index, 1);
// 						this.types[2].index = this.types[3].index + 1;
// 						this.types[3].marked = false;
// 						this.types[3].index = Number.POSITIVE_INFINITY;
// 						this._parse(2, endBoldIndex, false);
// 					}
// 				} else if (this.types[1].marked) {
// 					// Only Parse Italics, count last char as beginning
// 					let endItalicIndex = this.types[1].index;
// 					this._splitToken(this.types[3].index, 2);
// 					this.types[1].index = this.types[3].index + 1;
// 					this.types[3].marked = false;
// 					this.types[3].index = Number.POSITIVE_INFINITY;
// 					this._parse(1, endItalicIndex, false);
// 				}
// 			} else if (next == 2) {
// 				if (this.types[3].marked) {
// 					// Parse a bold token
// 					if (this.types[1].marked) {
// 						// Parse a bold and italic token
// 						if (this.types[1].index < this.types[3].index) {
// 							// Italic is inside a part of bold
// 							this._splitToken(this.types[3].index, 1);
// 							let endBoldIndex = this.types[3].index + 1;
// 							let endItalicIndex = this.types[3].index;
// 							this.types[3].marked = false;
// 							this.types[3].index = Number.POSITIVE_INFINITY;
// 							this._parse(1, endItalicIndex, false);
// 							this._parse(2, endBoldIndex, false);
// 						} else {
// 							// Italic is on the other side of bold
// 							this._splitToken(this.types[3].index, 2);
// 							let endBoldIndex = this.types[3].index;
// 							let endItalicIndex = this.types[3].index + 1;
// 							this.types[3].marked = false;
// 							this.types[3].index = Number.POSITIVE_INFINITY;
// 							this._parse(2, endBoldIndex, false);
// 							this._parse(1, endItalicIndex, false);
// 						}
// 					} else {
// 						this._splitToken(this.types[3].index, 2);
// 						let endBoldIndex = this.types[3].index;
// 						this.types[3].marked = false;
// 						this.types[3].index = Number.POSITIVE_INFINITY;
// 						this._parse(2, endBoldIndex, false);
// 					}
// 				}
// 			} else {
// 				if (this.types[3].marked) {
// 					// Parse an italic token
// 					if (this.types[2].marked) {
// 						// Parse a bold and italic
// 						if (this.types[2].index < this.types[3].index) {
// 							// Bold is inside italic
// 							this._splitToken(this.types[3].index, 2);
// 							let endBoldIndex = this.types[3].index;
// 							let endItalicIndex = this.types[3].index + 1;
// 							this.types[3].marked = false;
// 							this.types[3].index = Number.POSITIVE_INFINITY;
// 							this._parse(2, endBoldIndex, false);
// 							this._parse(1, endItalicIndex, false);
// 						} else {
// 							// Bold is on the other side of italic
// 							this._splitToken(this.types[3].index, 1);
// 							let endBoldIndex = this.types[3].index + 1;
// 							let endItalicIndex = this.types[3].index;
// 							this.types[3].marked = false;
// 							this.types[3].index = Number.POSITIVE_INFINITY;
// 							this._parse(1, endItalicIndex, false);
// 							this._parse(2, endBoldIndex, false);
// 						}
// 					} else {
// 						this._splitToken(this.types[3].index, 1);
// 						let endItalicIndex = this.types[3].index;
// 						this.types[3].marked = false;
// 						this.types[3].index = Number.POSITIVE_INFINITY;
// 						this._parse(1, endItalicIndex, false);
// 					}
// 				}
// 			}
// 			if (this.tokens.length > 1) {
// 				for (const [index, token] of this.tokens.entries()) {
// 					let preToken = this.tokens[index - 1];
// 					if (preToken && preToken.name == "text" && token.name == "text") {
// 						token.value = preToken.value + token.value;
// 						token.start = preToken.start;
// 					}
// 				}
// 			}
// 			return this.tokens;
// 		} else {
// 			return [];
// 		}
// 	}
// }
