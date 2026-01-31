export type Str = { val: string; index: number; saveToks: boolean };
const markdown: Str = {
	val: "",
	index: 0,
	saveToks: false,
};
export type Token = {
	name?: string;
	start: number;
	end: number;
	len: number;
	value?: string;
	tokens?: Token[];
	html?: string;
};
export type ParseResult = [boolean, Token[]?, Token[]?];
export type Parser = ((text: Str) => ParseResult) & {
	keys: string[];
};

export function char(char: string = ""): Parser {
	if (char === "") {
		const p: Parser = (text: Str): ParseResult => {
			if (text.index < text.val.length) text.index++;
			return [true];
		};
		p.keys = [""];
		return p;
	} else {
		const c = char[0];
		const p: Parser = (text: Str): ParseResult => {
			if (text.val[text.index] === c) {
				text.index++;
				return [true];
			} else return [false];
		};
		p.keys = [c];
		return p;
	}
}

export function maybe(parse: Parser) {
	const p: Parser = (text: Str): ParseResult => {
		const res = parse(text);
		if (res[0]) return res;
		else return [true];
	};
	p.keys = parse.keys;
	return p;
}

function findMinMax(
	min: number | undefined,
	max: number | undefined,
): [number, number] {
	if (min != undefined) {
		if (min < 0) min = 1;
		if ((max && max > 0 && max < min) || max == undefined) max = min;
	} else min = 1;
	if (max == undefined || max < 1) max = Number.POSITIVE_INFINITY;
	return [min, max];
}

export function rep(parse: Parser, min?: number, max?: number) {
	let [minmin, maxmax] = findMinMax(min, max);
	const p: Parser = (text: Str): ParseResult => {
		let count = 0;
		const tokens: Token[] = [];
		const start = text.index;
		while (text.index < text.val.length && count < maxmax) {
			const res = parse(text);
			if (res[0]) {
				if (res[1]) tokens.push(...res[1]);
				if (res[2]) tokens.push(...res[2]);
				count++;
			} else break;
		}
		if (count >= minmin) {
			if (tokens.length > 0) return [true, tokens];
			else return [true];
		} else {
			text.index = start;
			return [false];
		}
	};
	p.keys = parse.keys;
	return p;
}

export function repChar(char: string, min?: number, max?: number): Parser {
	let [minmin, maxmax] = findMinMax(min, max);
	const c = char[0];
	const p: Parser = (text: Str): ParseResult => {
		let count = 0;
		const start = text.index;
		while (
			text.index < text.val.length &&
			text.val[text.index] === c &&
			count < maxmax
		) {
			text.index++;
			count++;
		}
		if (count >= minmin) return [true];
		else {
			text.index = start;
			return [false];
		}
	};
	p.keys = [c];
	return p;
}

export function until(
	parse: Parser,
	ownEndTokens: boolean = false,
	matchEOF: boolean = false,
): Parser {
	const p: Parser = (text: Str): ParseResult => {
		const start = text.index;
		while (text.index < text.val.length) {
			const res = parse(text);
			if (res[0]) {
				if (ownEndTokens) return res;
				else {
					return [true, undefined, res[1]];
				}
			}
			text.index++;
		}
		if (matchEOF) {
			return [true];
		} else {
			text.index = start;
			return [false];
		}
	};
	p.keys = [""];
	return p;
}

export function untilStr(str?: string, matchEOF: boolean = false): Parser {
	if (str) {
		if (str === "") {
			const p: Parser = (text: Str): ParseResult => {
				text.index = text.val.length;
				return [true];
			};
			p.keys = [""];
			return p;
		}
		const p: Parser = (text: Str): ParseResult => {
			if (text.index > text.val.length) return [false];
			const end = text.val.indexOf(str, text.index);
			if (end === -1) {
				if (matchEOF) {
					text.index = text.val.length;
					return [true];
				} else return [false];
			}
			text.index = end + str.length;
			return [true];
		};
		p.keys = [""];
		return p;
	} else {
		const p: Parser = (text: Str): ParseResult => {
			if (text.index === 0) return [true];
			else return [false];
		};
		p.keys = [""];
		return p;
	}
}

export function repUntil(
	repper: Parser,
	ender: Parser,
	optionalRep: boolean = true,
	ownEndTokens: boolean = false,
	matchEOF: boolean = false,
): Parser {
	const p: Parser = (text: Str): ParseResult => {
		const start = text.index;
		const children: Token[] = [];
		const afters: Token[] = [];
		if (optionalRep) {
			const end = ender(text);
			if (end[0]) {
				if (end[1]) {
					if (ownEndTokens) children.push(...end[1]);
					else afters.push(...end[1]);
				}
				if (end[2]) {
					if (ownEndTokens) children.push(...end[2]);
					else afters.push(...end[2]);
				}
				if (children.length > 0) return [true, children];
				else if (afters.length > 0) return [true, undefined, afters];
				else return [true];
			}
		}
		while (text.index < text.val.length) {
			const res = repper(text);
			if (res[0]) {
				if (res[1]) children.push(...res[1]);
				if (res[2]) children.push(...res[2]);
				const end = ender(text);
				if (end[0]) {
					if (end[1]) {
						if (ownEndTokens) children.push(...end[1]);
						else afters.push(...end[1]);
					}
					if (end[2]) {
						if (ownEndTokens) children.push(...end[2]);
						else afters.push(...end[2]);
					}
					if (children.length > 0 && afters.length > 0)
						return [true, children, afters];
					else if (children.length > 0) return [true, children];
					else if (afters.length > 0) return [true, undefined, afters];
					else return [true];
				}
			} else {
				text.index = start;
				return [false];
			}
		}
		if (matchEOF) {
			if (children.length > 0) return [true, children];
			else return [true];
		} else {
			text.index = start;
			return [false];
		}
	};
	p.keys = repper.keys;
	return p;
}

export function run(parsers: Parser[]): Parser {
	const p: Parser = (text: Str): ParseResult => {
		const start = text.index;
		const tokens: Token[] = [];
		for (let i = 0; i < parsers.length; i++) {
			const res = parsers[i](text);
			if (res[0]) {
				if (res[1]) tokens.push(...res[1]);
			} else {
				text.index = start;
				return [false];
			}
		}
		if (tokens.length > 0) return [true, tokens];
		else return [true];
	};
	p.keys = parsers[0].keys;
	return p;
}

export function any(parsers: Parser[]): Parser {
	const map = new Map<string, Parser[]>();
	const startAnywhere: Parser[] = [];

	for (let i = 0; i < parsers.length; i++) {
		const parse = parsers[i];
		for (let j = 0; j < parse.keys.length; j++) {
			const char = parse.keys[j];
			if (char === "") {
				startAnywhere.push(parse);
			} else {
				if (!map.has(char)) map.set(char, []);
				map.get(char)!.push(parse);
			}
		}
	}

	const p: Parser = (text: Str): ParseResult => {
		const char = text.val[text.index];
		const primary = map.get(char);
		if (primary) {
			for (let i = 0; i < primary.length; i++) {
				const res = primary[i](text);
				if (res[0]) return res;
			}
		}
		for (let i = 0; i < startAnywhere.length; i++) {
			const res = startAnywhere[i](text);
			if (res[0]) return res;
		}
		return [false];
	};

	const allStarts = new Set<string>();
	for (let i = 0; i < parsers.length; i++) {
		const ps = parsers[i].keys;
		for (let j = 0; j < ps.length; j++) {
			allStarts.add(ps[j]);
		}
	}
	p.keys = Array.from(allStarts);

	return p;
}

export function lazy(fn: () => Parser): Parser {
	let cached: Parser | null = null;
	const p: Parser = (text: Str): ParseResult => {
		if (!cached) cached = fn();
		return cached(text);
	};
	// We can't easily know startsWith before execution for lazy
	p.keys = [""];
	return p;
}

export function not(parser: Parser, takeOnNot: number = 0): Parser {
	const p: Parser = (text: Str): ParseResult => {
		const start = text.index;
		const res = parser(text);
		if (res[0]) {
			text.index = start;
			return [false];
		} else {
			text.index += takeOnNot;
			return [true];
		}
	};
	p.keys = [""];
	return p;
}

// export function check(
// 	parse: Parser,
// 	before: (text: Str) => boolean = () => true,
// 	after: (text: Str, toks: Token[] | undefined) => boolean = () => true,
// ): Parser {
// 	const p: Parser = (text: Str): ParseResult => {
// 		const start = text.index;
// 		if (before(text)) {
// 			const res = parse(text);
// 			if (res[0] && after(text, res[1])) return res;
// 		}
// 		text.index = start;
// 		return [false];
// 	};
// 	p.keys = parse.keys;
// 	return p;
// }

export function token(
	parse: Parser,
	name?: string,
	saveValue: boolean = true,
	render?: (tok: Token, text: Str) => void,
) {
	const p: Parser = (text: Str): ParseResult => {
		const start = text.index;
		const [yes, children, afters] = parse(text);
		if (yes) {
			const tok: Token = { start, end: text.index, len: text.index - start };
			const result: ParseResult = [true, [tok]];
			if (name) tok.name = name;
			if (children) tok.tokens = children;
			if (afters) {
				if (tok.start === afters[0].start && tok.end === afters[0].end)
					return [true, afters];
				tok.end = afters[0].start;
				tok.len = tok.end - tok.start;
				result[1]!.push(...afters);
			}
			if (saveValue) tok.value = text.val.slice(tok.start, tok.end);
			if (render) render(tok, text);
			return result;
		}
		return [yes, children, afters];
	};
	p.keys = parse.keys;
	return p;
}

const whiteSpace = rep(any([char(" "), char("\t"), char("\n")]));

function renderHeading(tok: Token, text: Str) {
	const conStart = text.val.indexOf(" ", tok.start) + 1;
	const hashes = text.val.slice(tok.start, conStart);
	const level = hashes.length - 1;
	const content = text.val.slice(conStart, tok.end);
	tok.html = `<h${level}><span class="peek">${hashes}</span>${content}</h${level}>`;
}

function renderParagraph(tok: Token, text: Str) {
	tok.html = `<p>${text.val.slice(tok.start, tok.end)}</p>`;
}

export function renderTokens(toks: Token[]): string {
	let html = "";
	for (let i = 0; i < toks.length; i++) {
		html += toks[i].html ?? "";
	}
	return html;
}

const iMark = char("*");
const italic = token(
	run([iMark, lazy(() => inline(italic, iMark)), iMark]),
	"italic",
);

const endMarks = any([iMark, char("\n")]);
const inl = rep(run([not(endMarks), char()]));
function inline(current?: Parser, stop?: Parser): Parser {
	const inlines = [inl, italic];
	if (current && stop) {
		let i = inlines.indexOf(current);
		inlines.splice(i, 1);
		return rep(any(inlines));
	}
	let im = char("*");
	im.keys = [""];
	inlines.push(im);
	inlines.push(untilStr("\n", true));
	return rep(any(inlines));
}

const heading = token(
	run([repChar("#", 1, 6), char(" "), untilStr("\n", true)]),
	"heading",
	true,
	renderHeading,
);
const blocks = any([heading]);

const test = rep(
	token(
		repUntil(
			untilStr("\n", true),
			any([blocks, repChar("\n", 2)]),
			true,
			false,
			true,
		),
		"paragraph",
	),
);

markdown.val = "# Jotter!\nHello man\n".repeat(500000);
markdown.saveToks = false;
markdown.index = 0;

const perfStart = performance.now();
const result = test(markdown);
const perfEnd = performance.now();

// console.log(result);
// console.log(result.html);
// console.log(JSON.stringify(result, null, 2));
// console.log(`Parsed Tokens: ${result!.tokens?.length.toLocaleString() ?? 0}`);
console.log(`Markdown Length: ${markdown.val.length.toLocaleString()}`);
console.log(`Time: ${(perfEnd - perfStart).toFixed(2)}ms`);
