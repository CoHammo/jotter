class Parse {
	marks: string;
	level: string;
	startIndex: number = -1;
	blockParsers: Map<string, typeof Parse> = new Map();
	inlineParsers: Map<string, typeof Parse> = new Map();
	tokens: string[] = [];

	constructor() {
		this.marks = "";
		this.level = "block";
	}

	parse(
		text: string,
		index: number,
		blockParsers?: Map<string, typeof Parse>,
		inlineParsers?: Map<string, typeof Parse>,
	): [string[] | undefined, number] {
		this.startIndex = index;
		let checkForBlocks = false;
		for (index; index < text.length; index++) {
			if (index == 0) {
				index = this.parseBlocks(text, index);
			} else if (text[index] == "\n") {
				checkForBlocks = true;
			} else if (checkForBlocks) {
				index = this.parseBlocks(text, index);
				checkForBlocks = false;
			}
		}
		if (this.startIndex < index) {
			this.tokens.push(text.substring(this.startIndex, index));
		}
		return [this.tokens, text.length];
	}

	parseBlocks(text: string, index: number): number {
		if (this.blockParsers.has(text[index])) {
			let parser = new (this.blockParsers.get(text[index])!)();
			let res = parser.parse(text, index);
			if (res[0]) {
				if (index > 1) this.tokens.push(text.substring(this.startIndex, index));
				this.tokens.push(...res[0]);
				index = res[1];
				this.startIndex = index;
				return index;
			}
		}
		return index;
	}
}

class HeadingParse extends Parse {
	constructor() {
		super();
		this.marks = "#";
		this.level = "block";
	}

	parse(
		text: string,
		index: number,
		blockParsers?: Map<string, typeof Parse>,
		inlineParsers?: Map<string, typeof Parse>,
	): [string[] | undefined, number] {
		this.startIndex = index;
		return [[text.substring(this.startIndex, index + 1)], index + 1];
	}
}

class Parser {
	marks = "";
	start = -1;
	children: Map<string, Parser> = new Map();
	static next(
		char: string,
		index: number,
		parser: Parser,
	): {
		parser: Parser | undefined;
		isToken: boolean;
	} {
		if (parser.start == -1) {
			parser.start = index;
			return { parser: parser, isToken: true };
		} else {
			if (parser.children.has(char)) {
				let p = parser.children.get(char)!;
				Parser.next(char, index, p);
				return {
					parser: p,
					isToken: false,
				};
			} else {
				return { parser: parser, isToken: true };
			}
		}
	}
}

class Maker {
	currentParser: Parser | undefined;
	parser: Parser;
	constructor(parser: Parser) {
		this.parser = parser;
	}
	next(char: string, index: number) {
		// console.log(this.currentParser);
		if (this.currentParser) {
			let res = Parser.next(char, index, this.currentParser);
			if (res.parser) {
				this.currentParser = res.parser;
			}
		} else {
			if (this.parser.marks == char) {
				this.currentParser = this.parser;
				Parser.next(char, index, this.currentParser);
			}
		}
	}
}

class Char {
	char: string;
	from: number;
	to: number;
	constructor(char: string, from?: number, to?: number) {
		this.char = char;
		this.from = from ?? 1;
		this.to = to ?? 1;
	}
}

class Rule {
	pat: Char[];
	parse: (text: string, index: number) => boolean;

	constructor(pat: Char[], parse: (text: string, index: number) => boolean) {
		this.pat = pat;
		this.parse = parse;
	}
}

const HRule = new Rule(
	[new Char("\n"), new Char("#", 1, 6), new Char(" ")],
	() => true,
);

class P {
	char: string;
	subs: Map<string, P> = new Map();
	constructor(char: string) {
		this.char = char[0];
	}
	parse(text: string, index: number): boolean {
		return false;
	}
}

function makeParser(rule: Rule) {
	for (let i = 0; i < rule.pat.length; i++) {}
}

function char(char: string, from: number = 1, to: number = 1) {
	if (from < 1) from = 1;
	if (to < 1) to = 0;
	return (text: string, index: number): [string | null, number] => {
		let start = index;
		let found = 0;
		for (index; index < (to == 0 ? text.length : index + to); index++) {
			if (text[index] == char[0]) found++;
			else break;
		}
		if (found >= from) return [text.substring(start, index), found];
		else return [null, 0];
	};
}

let markdown = "# Jotter!\n# Hey".repeat(1);
let parser = new Parse();
parser.blockParsers.set("#", HeadingParse);
let hparse = char("#", 1, 6);
let perfStart = performance.now();
let res = hparse(markdown, 0);
// let results = parser.parse(markdown, 0);
let perfEnd = performance.now();
console.log(res);
// console.log(results);
console.log(`${(perfEnd - perfStart).toFixed(2)}ms`);
