const TokenType = {
	root: "root",
	heading: "heading",
	list: "list",
	paragraph: "paragraph",
	codeBlock: "codeBlock",
	fancyText: "fancyText",
	boldItalic: "boldItalic",
	italic: "italic",
	bold: "bold",
	codespan: "codespan",
	text: "text",
};

const Reg = {
	// blocks
	heading: String.raw`(?:^(?<hashes>#{1,6})(?<value> .*)$|^(?<value>.+)\n(?<lines>=+|-+)$)`,
	code: String.raw`^(?<fence>(?:\`|~){3})(?<lang>\w*)\s(?<value>[\s\S]*?)\k<fence>$`,
	paragraph: String.raw`(?:\r?\n|^)(?![#>-]|\s*[*+-]|\s*\d+\.|\`{3,}|~{3,})(?<value>[\s\S]+?)(?=\n\s*\n|$)`,

	// inlines
	codespan: String.raw`(?:(?<!\\)(?<ticks>(?:\`){1,2})(?!\`)(?<value>.+?)(?<!\\)\k<ticks>)`,
	boldItalic: String.raw`(?:(?<!\\)(?<marks>(?:\*|_){3})(?!\*)(?<value>.+?)(?<!\\)\k<marks>)`,
	bold: String.raw`(?<!(?:(?:\*|_){1})(?!\s|\*).*?)(?:(?<!\\)(?<marks>(?:\*|_){2})(?!\s|\*)(?<value>.+?)(?<!\\)\k<marks>)`,
	italic: String.raw`(?:(?<!\\)(?<marks>(?:\*|_){1})(?!\*)(?<value>.+?)(?<!\\)\k<marks>)`,
	boldOrItalic: String.raw`(?:(?<!\\)(?<marks>(?:\*|_){1,2})(?!\*)(?<value>.+?)(?<!\\)\k<marks>)`,
};

class Token {
	type: string;
	start: number;
	end: number;
	raw: string;
	static allBlockReg: RegExp;
	static allInlineReg: RegExp;
	static boldReg: RegExp;
	static italicReg: RegExp;
	static boldOrItalic: RegExp;
	tokens: Token[] = [];

	get length() {
		return this.end - this.start;
	}

	constructor(type: string, start: number, end: number, raw: string) {
		this.type = type;
		this.start = start;
		this.end = end;
		this.raw = raw;

		Token.allBlockReg = new RegExp(
			[Reg.heading, Reg.code, Reg.paragraph].join("|"),
			"gm",
		);
		Token.allInlineReg = new RegExp(
			[Reg.codespan, Reg.boldItalic].join("|"),
			"gm",
		);
		Token.boldReg = new RegExp(Reg.bold, "gm");
		Token.italicReg = new RegExp(Reg.italic, "gm");
		Token.boldOrItalic = new RegExp(Reg.boldOrItalic, "gm");
	}

	toHTML(): string {
		let html = "";
		for (const token of this.tokens) {
			html += token.toHTML();
		}
		return html;
	}

	_parse(): boolean {
		return true;
	}

	// 	_parseInline(regex: RegExp, text: string, start: number, end: number) {
	// 		let previousTokenEnd = start;
	// 		let matches = text.matchAll(Token.allInlineReg);
	// 		for (const match of matches) {
	// 			if (previousTokenEnd < match.index) {
	// 				this.tokens.push(
	// 					new TextToken(
	// 						text.substring(previousTokenEnd, match.index),
	// 						previousTokenEnd,
	// 						match.index,
	// 					),
	// 				);
	// 			}

	// 			let { value, ticks, marks } = match.groups!;
	// 			if (ticks) {
	// 				this.tokens.push(new CodeSpanToken(match));
	// 			} else if (marks) {
	// 				if (marks.length == 3) {
	// 					this.tokens.push(new BoldItalicToken());
	// 				} else if (marks.length == 2) {
	// 					this.tokens.push(new BoldToken());
	// 				} else if (marks.length == 1) {
	// 					this.tokens.push(new ItalicToken());
	// 				} else {
	// 					this.tokens.push(
	// 						new TextToken(value, match.index, match.index + match[0].length),
	// 					);
	// 				}
	// 			}

	// 			previousTokenEnd = match.index + match[0].length;
	// 		}

	// 		if (previousTokenEnd < end) {
	// 			this.tokens.push(
	// 				new TextToken(
	// 					text.substring(previousTokenEnd, end),
	// 					previousTokenEnd,
	// 					end,
	// 				),
	// 			);
	// 		}
	// 	}
}

class RootToken extends Token {
	constructor(length: number, raw: string) {
		super(TokenType.root, 0, length, raw);
		this._parse();
	}

	_parse(): boolean {
		let previousTokenEnd = 0;
		let matches = this.raw.matchAll(Token.allBlockReg);
		for (const match of matches) {
			if (previousTokenEnd < match.index) {
				this.tokens.push(
					new ParagraphToken(
						previousTokenEnd,
						match.index,
						this.raw.substring(previousTokenEnd, match.index),
					),
				);
			}

			let { value, hashes, lines, fence, lang } = match.groups!;
			let start = match.index;
			let end = match.index + match[0].length;
			if (hashes || lines) {
				this.tokens.push(
					new HeadingToken(start, end, value, hashes, lines, match[0]),
				);
			} else if (fence) {
				this.tokens.push(
					new CodeBlockToken(start, end, value, fence, lang, match[0]),
				);
			} else {
				this.tokens.push(new ParagraphToken(start, end, value));
			}

			// console.log(match);
			previousTokenEnd = match.index + match[0].length;
		}

		if (previousTokenEnd == 0 || previousTokenEnd < this.end) {
			this.tokens.push(
				new ParagraphToken(
					previousTokenEnd,
					this.end,
					this.raw.substring(previousTokenEnd, this.end),
				),
			);
		}
		return true;
	}
}

class HeadingToken extends Token {
	depth: number;
	hashes: string | undefined;
	lines: string | undefined;

	constructor(
		start: number,
		end: number,
		value: string,
		hashes: string | undefined,
		lines: string | undefined,
		raw: string,
	) {
		super(TokenType.heading, start, end, raw);
		if (this.hashes) {
			this.depth = this.hashes.length;
		} else if (this.lines) {
			if (this.lines.at(0) == "=") this.depth = 1;
			else this.depth = 2;
		} else {
			this.depth = 1;
		}

		this.tokens.push(
			new TextToken(
				value,
				this.start + (hashes?.length ?? 0),
				this.end - (lines?.length ?? 0),
			),
		);
	}

	toHTML(): string {
		let content = super.toHTML();
		if (this.hashes) {
			return `<h${this.depth}>${this.hashes}${content}</h${this.depth}>`;
		} else {
			return `<h${this.depth}>${content}\n${this.lines}</h${this.depth}>`;
		}
	}
}

class CodeBlockToken extends Token {
	fence: string;
	lang: string | undefined;

	constructor(
		start: number,
		end: number,
		value: string,
		fence: string,
		lang: string | undefined,
		raw: string,
	) {
		super(TokenType.codeBlock, start, end, raw);
		this.fence = fence;
		this.lang = lang;

		this.tokens.push(
			new TextToken(
				value,
				this.start + fence.length + (lang?.length ?? 0),
				this.end - (fence?.length ?? 0),
			),
		);
	}

	toHTML(): string {
		let content = super.toHTML();
		return `<code>${this.fence}${this.lang}${content}${this.fence}<code>`;
	}
}

class ParagraphToken extends Token {
	constructor(start: number, end: number, value: string) {
		super(TokenType.paragraph, start, end, value);

		this.tokens.push(new TextToken(value, this.start, this.end));
	}

	toHTML(): string {
		let content = super.toHTML();
		return `<p>${content}</p>`;
	}
}

// class BoldItalicToken extends Token {
// 	marks: string;

// 	constructor(match: RegExpExecArray) {
// 		super(
// 			TokenType.boldItalic,
// 			match.index,
// 			match.index + match[0].length,
// 			match[0],
// 		);
// 		this.marks = "";
// 		this.#parse(match);
// 	}

// 	#parse(match?: RegExpExecArray) {
// 		if (match) {
// 			let { value, marks } = match.groups!;
// 			this.marks = marks;
// 			this.raw = match[0];
// 			let textStart = match.index + marks.length;
// 		}
// 	}

// 	toHTML(): string {
// 		let content = super.toHTML();
// 		return `<strong><em>${this.marks}${content}${this.marks}</em></strong>`;
// 	}
// }

class BoldToken extends Token {
	marks: string;

	constructor(
		start: number,
		end: number,
		value: string,
		marks: string,
		raw: string,
	) {
		super(TokenType.bold, start, end, raw);
		this.marks = marks;
		this.tokens.push(
			new TextToken(value, start + marks.length, end - marks.length),
		);
	}

	toHTML(): string {
		let content = super.toHTML();
		return `<em>${this.marks}${content}${this.marks}</em>`;
	}
}

class ItalicToken extends Token {
	marks: string;

	constructor(
		start: number,
		end: number,
		value: string,
		marks: string,
		raw: string,
	) {
		super(TokenType.italic, start, end, raw);
		this.marks = marks;
		this.tokens.push(
			new TextToken(value, start + marks.length, end - marks.length),
		);
	}

	toHTML(): string {
		let content = super.toHTML();
		return `<em>${this.marks}${content}${this.marks}</em>`;
	}
}

class CodeSpanToken extends Token {
	ticks: string;

	constructor(
		start: number,
		end: number,
		value: string,
		ticks: string,
		raw: string,
	) {
		super(TokenType.codespan, start, end, raw);
		this.ticks = ticks;
		this.tokens.push(
			new TextToken(value, start + ticks.length, end - ticks.length),
		);
	}

	toHTML(): string {
		let value = super.toHTML();
		return `<code>${this.ticks}${value}${this.ticks}</code>`;
	}
}

class TempTextToken extends Token {
	constructor(value: string, start: number, end: number) {
		super(TokenType.text, start, end, value);

		let matches = this.raw.matchAll(Token.boldOrItalic);
		let previousTokenEnd = 0;
		for (const match of matches) {
			if (previousTokenEnd < match.index) {
				let textStart = this.start + previousTokenEnd;
				this.tokens.push(
					new TextToken(
						this.raw.substring(previousTokenEnd, match.index),
						textStart,
						textStart + match[0].length,
					),
				);
			}

			let { value, marks } = match.groups!;
			let start = this.start + match.index;
			let end = start + match[0].length;
			if (marks.length == 2) {
				this.tokens.push(new BoldToken(start, end, value, marks, match[0]));
			} else if (marks.length == 1) {
				this.tokens.push(new ItalicToken(start, end, value, marks, match[0]));
			}
			previousTokenEnd = match.index;
		}

		if (previousTokenEnd < this.end) {
			this.tokens.push(new TextToken(this.raw, previousTokenEnd, this.end));
		}
	}
}

class TextToken extends Token {
	get value() {
		return this.raw;
	}

	constructor(value: string, start: number, end: number) {
		super(TokenType.text, start, end, value);
	}

	toHTML(): string {
		return this.raw;
	}

	_parse() {
		return true;
	}
}

let markdown = "## Jotter\n\nhello therethis\n```java\nhello world\n```".repeat(
	10000,
);

let perfStart = performance.now();
let doc = new RootToken(markdown.length, markdown);
let perfEnd = performance.now();

let perf = perfEnd - perfStart;
console.log(doc);
console.log(markdown.length.toLocaleString());
console.log(`${perf.toFixed(2)}ms`);

// function tokenize(markdown: string): Token {
// 	let blockRegex = new RegExp(
// 		[Reg.header, Reg.code, Reg.paragraph].join("|"),
// 		"gm",
// 	);
// 	let inlineRegex = new RegExp([Reg.boldItalic, Reg.codespan].join("|"), "gm");

// 	let perfStart = performance.now();
// 	let docTree = new RootToken(
// 		markdown.length,
// 		markdown,
// 		tokenizeBlocks(markdown, blockRegex, inlineRegex, 0, markdown.length),
// 	);
// 	let perfEnd = performance.now();
// 	console.log(docTree);
// 	console.log(docTree.toHTML());
// 	console.log(`${(perfEnd - perfStart).toFixed(2)}ms`);

// 	return docTree;
// }

// function tokenizeBlocks(
// 	text: string,
// 	blockRegex: RegExp,
// 	inlineRegex: RegExp,
// 	start: number,
// 	end: number,
// ): Token[] {
// 	let tokens: Token[] = [];
// 	let previousTokenEnd = start;
// 	let matches = text.matchAll(blockRegex);
// 	for (const match of matches) {
// 		let { content, hashes, lines, fence, lang } = match.groups;
// 		let tokenStart = match.index;
// 		let tokenEnd = tokenStart + match[0].length;
// 		let token: Token;
// 		if (hashes || lines) {
// 			// This is a Header
// 			token = new HeadingToken(
// 				tokenStart,
// 				tokenEnd,
// 				hashes,
// 				lines,
// 				text.substring(tokenStart, tokenEnd),
// 				tokenizeInlines(content, inlineRegex, tokenStart, tokenEnd),
// 			);
// 		} else if (fence) {
// 			// Code Block
// 			token = new CodeBlockToken(
// 				tokenStart,
// 				tokenEnd,
// 				fence,
// 				lang,
// 				text.substring(tokenStart, tokenEnd),
// 				tokenizeInlines(content, null, tokenStart, tokenEnd),
// 			);
// 		} else {
// 			token = new ParagraphToken(
// 				tokenStart,
// 				tokenEnd,
// 				text.substring(tokenStart, tokenEnd),
// 				tokenizeInlines(content, inlineRegex, tokenStart, tokenEnd),
// 			);
// 		}

// 		if (previousTokenEnd < tokenStart) {
// 			tokens.push(
// 				new ParagraphToken(
// 					previousTokenEnd,
// 					tokenStart,
// 					text.substring(previousTokenEnd, tokenStart),
// 					tokenizeInlines(
// 						text.substring(previousTokenEnd, tokenStart),
// 						inlineRegex,
// 						previousTokenEnd,
// 						tokenStart,
// 					),
// 				),
// 			);
// 		}

// 		tokens.push(token);
// 		previousTokenEnd = tokenEnd;
// 		// console.log(match);
// 	}

// 	if (previousTokenEnd > 0 && previousTokenEnd < end) {
// 		tokens.push(
// 			new ParagraphToken(
// 				previousTokenEnd,
// 				end,
// 				text.substring(previousTokenEnd, end),
// 				tokenizeInlines(
// 					text.substring(previousTokenEnd, end),
// 					inlineRegex,
// 					previousTokenEnd,
// 					end,
// 				),
// 			),
// 		);
// 	}

// 	if (tokens.length == 0) {
// 		tokens.push(
// 			new ParagraphToken(
// 				0,
// 				end,
// 				text,
// 				tokenizeInlines(text, inlineRegex, 0, end),
// 			),
// 		);
// 	}

// 	return tokens;
// }

// function tokenizeInlines(
// 	text: string,
// 	regex: RegExp | null,
// 	start: number,
// 	end: number,
// ): Token[] {
// 	let tokens: Token[] = [];
// 	let previousTokenEnd = start;
// 	let inlines;
// 	if (regex) inlines = text.matchAll(regex);
// 	for (const match of inlines ?? []) {
// 		let { content, marks, ticks } = match.groups;
// 		let tokenStart = match.index;
// 		let tokenEnd = match[0].length;
// 		let token: Token;
// 		if (marks) {
// 			if (marks.length == 3) {
// 				token = new BoldItalicToken(
// 					tokenStart,
// 					tokenEnd,
// 					marks,
// 					text.substring(tokenStart, tokenEnd),
// 					tokenizeInlines(
// 						content,
// 						new RegExp(Reg.bold, "gm"),
// 						tokenStart,
// 						tokenEnd,
// 					),
// 				);
// 			} else if (marks.length == 2) {
// 				token = new BoldToken(
// 					tokenStart,
// 					tokenEnd,
// 					marks,
// 					text.substring(tokenStart, tokenEnd),
// 					tokenizeInlines(
// 						content,
// 						new RegExp(Reg.italic, "gm"),
// 						tokenStart,
// 						tokenEnd,
// 					),
// 				);
// 			} else if (marks.length == 2) {
// 				token = new ItalicToken(
// 					tokenStart,
// 					tokenEnd,
// 					marks,
// 					text.substring(tokenStart, tokenEnd),
// 					[new TextToken(content, tokenStart, tokenEnd, [])],
// 				);
// 			} else {
// 				token = new TextToken(content, tokenStart, tokenEnd, []);
// 			}
// 		} else if (ticks) {
// 			token = new CodeSpanToken(
// 				tokenStart,
// 				tokenEnd,
// 				ticks,
// 				text.substring(tokenStart, tokenEnd),
// 				[new TextToken(content, tokenStart, tokenEnd, [])],
// 			);
// 		} else {
// 			token = new TextToken(content, tokenStart, tokenEnd, []);
// 		}

// 		if (previousTokenEnd < tokenStart) {
// 			tokens.concat(
// 				tokenizeInlines(
// 					text.substring(previousTokenEnd, tokenStart),
// 					new RegExp(Reg.boldItalic, "gm"),
// 					previousTokenEnd,
// 					tokenStart,
// 				),
// 			);
// 		}

// 		tokens.push(token);
// 		previousTokenEnd = tokenEnd;
// 	}

// 	if (previousTokenEnd > 0 && previousTokenEnd < end) {
// 		tokens.concat(
// 			tokenizeInlines(
// 				text.substring(previousTokenEnd, end),
// 				new RegExp(Reg.boldItalic, "gm"),
// 				previousTokenEnd,
// 				end,
// 			),
// 		);
// 	}

// 	if (tokens.length == 0) {
// 		tokens.push(new TextToken(text, start, end, []));
// 	}

// 	return tokens;
// }
