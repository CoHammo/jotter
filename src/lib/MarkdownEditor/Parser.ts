export type Str = { val: string; saveToks: boolean };
const markdown: Str = {
	val: "",
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
	save?: boolean;
};
export type Parser = ((text: Str, index: number) => Token | null) & {
	startsWith: string[];
};

export function char(c: string = ""): Parser {
	if (c === "") {
		const p: Parser = (text: Str, index: number): Token | null => {
			if (index < text.val.length)
				return { start: index, end: index + 1, len: 1 };
			else return null;
		};
		p.startsWith = [""];
		return p;
	} else {
		const char0 = c[0];
		const p: Parser = (text: Str, index: number): Token | null => {
			if (text.val[index] === char0)
				return { start: index, end: index + 1, len: 1 };
			else return null;
		};
		p.startsWith = [char0];
		return p;
	}
}

export function rep(parse: Parser, min: number = 1, max: number = 0) {
	if (min < 0) min = 0;
	if (max >= 1 && max < min) max = min;
	const p: Parser = (text: Str, index: number): Token | null => {
		if (max < 1) max = text.val.length;
		let count = 0;
		const start = index;
		const tokens: Token[] = [];
		while (index < text.val.length && count < max) {
			const tok = parse(text, index);
			if (tok) {
				if (tok.save || text.saveToks) tokens.push(tok);
				else if (tok.tokens) tokens.push(...tok.tokens);
				index += tok.len;
				count++;
			} else break;
		}
		if (count >= min)
			return {
				start,
				end: index,
				len: index - start,
				tokens,
			};
		else return null;
	};
	p.startsWith = parse.startsWith;
	return p;
}

export function until(
	parse: Parser,
	inclusive: boolean = false,
	matchEOF: boolean = false,
): Parser {
	const p: Parser = (text: Str, index: number): Token | null => {
		const start = index;
		while (index < text.val.length) {
			const tok = parse(text, index);
			if (tok) {
				if (inclusive) {
					index += tok.len;
					return {
						start,
						end: index,
						len: index - start,
						tokens: tok.save || text.saveToks ? [tok] : tok.tokens,
					};
				} else {
					return { start, end: index, len: index - start };
				}
			}
			index++;
		}
		if (matchEOF) return { start, end: index, len: index - start };
		else return null;
	};
	p.startsWith = [""];
	return p;
}

export function untilStr(
	str?: string,
	inclusive: boolean = false,
	matchEOF: boolean = false,
): Parser {
	if (str) {
		if (str === "") {
			const p: Parser = (text: Str, index: number): Token | null => {
				return {
					start: index,
					end: text.val.length,
					len: text.val.length - index,
				};
			};
			p.startsWith = [""];
			return p;
		}
		const p: Parser = (text: Str, index: number): Token | null => {
			if (index > text.val.length) return null;
			let end = text.val.indexOf(str, index);
			if (end === -1) {
				if (matchEOF)
					return {
						start: index,
						end: text.val.length,
						len: text.val.length - index,
					};
				else return null;
			}
			end += inclusive ? str.length : 0;
			return {
				start: index,
				end,
				len: end - index,
			};
		};
		p.startsWith = [""];
		return p;
	} else {
		const p: Parser = (text: Str, index: number): Token | null => {
			if (index === 0) return { start: 0, end: 0, len: 0 };
			else return null;
		};
		p.startsWith = [""];
		return p;
	}
}

export function run(parsers: Parser[]): Parser {
	const p: Parser = (text: Str, index: number): Token | null => {
		const start = index;
		const tokens: Token[] = [];
		for (let i = 0; i < parsers.length; i++) {
			const tok = parsers[i](text, index);
			if (tok) {
				index += tok.len;
				if (tok.save || text.saveToks) tokens.push(tok);
				else if (tok.tokens) tokens.push(...tok.tokens);
			} else return null;
		}
		return {
			start,
			end: index,
			len: index - start,
			tokens,
		};
	};
	p.startsWith = parsers[0].startsWith;
	return p;
}

export function any(parsers: Parser[]): Parser {
	const map = new Map<string, Parser[]>();
	const startAnywhere: Parser[] = [];

	for (let i = 0; i < parsers.length; i++) {
		const parse = parsers[i];
		for (let j = 0; j < parse.startsWith.length; j++) {
			const char = parse.startsWith[j];
			if (char === "") {
				startAnywhere.push(parse);
			} else {
				if (!map.has(char)) map.set(char, []);
				map.get(char)!.push(parse);
			}
		}
	}

	const p: Parser = (text: Str, index: number): Token | null => {
		const char = text.val[index];
		const primary = map.get(char);
		if (primary) {
			for (let i = 0; i < primary.length; i++) {
				const res = primary[i](text, index);
				if (res) return res;
			}
		}
		for (let i = 0; i < startAnywhere.length; i++) {
			const res = startAnywhere[i](text, index);
			if (res) return res;
		}
		return null;
	};

	const allStarts = new Set<string>();
	for (let i = 0; i < parsers.length; i++) {
		const ps = parsers[i].startsWith;
		for (let j = 0; j < ps.length; j++) {
			allStarts.add(ps[j]);
		}
	}
	p.startsWith = Array.from(allStarts);

	return p;
}

export function lazy(fn: () => Parser): Parser {
	let cached: Parser | null = null;
	const p: Parser = (text: Str, index: number): Token | null => {
		if (!cached) cached = fn();
		return cached(text, index);
	};
	// We can't easily know startsWith before execution for lazy
	p.startsWith = [""];
	return p;
}

export function not(parser: Parser, takeOnNot: number = 0): Parser {
	const p: Parser = (text: Str, index: number): Token | null => {
		const res = parser(text, index);
		if (res) return null;
		else return { start: index, end: index + takeOnNot, len: takeOnNot };
	};
	p.startsWith = [""];
	return p;
}

export function all(parse: Parser, tokenize: boolean = true): Parser {
	const p: Parser = (text: Str, index: number): Token | null => {
		const start = index;
		const tokens: Token[] = [];
		let count = 0;
		while (index < text.val.length) {
			const tok = parse(text, index);
			if (tok) {
				if (tok.save || text.saveToks) tokens.push(tok);
				else if (tok.tokens) tokens.push(...tok.tokens);
				index += tok.len;
				count++;
			} else index++;
		}
		if (count === 0) return null;
		else return { start, end: index, len: index - start, tokens };
	};
	p.startsWith = parse.startsWith;
	return p;
}

export function check(
	parse: Parser,
	before: (text: Str, index: number) => boolean = () => true,
	after: (tok: Token, text: Str) => boolean = () => true,
): Parser {
	const p: Parser = (text: Str, index: number): Token | null => {
		if (before(text, index)) {
			const tok = parse(text, index);
			if (tok && after(tok, text)) return tok;
		}
		return null;
	};
	p.startsWith = parse.startsWith;
	return p;
}

export function render(
	parse: Parser,
	name?: string,
	saveValue: boolean = false,
	render: ((tok: Token, text: Str) => void) | null = (
		tok: Token,
		text: Str,
	) => {
		if (tok) {
			if (tok.value) tok.html = tok.value;
			else tok.html = text.val.slice(tok.start, tok.end);
		}
	},
) {
	const p: Parser = (text: Str, index: number): Token | null => {
		const tok = parse(text, index);
		if (tok) {
			tok.save = true;
			if (name) tok.name = name;
			if (saveValue) tok.value = text.val.slice(tok.start, tok.end);
			if (render) render(tok, text);
		}
		return tok;
	};
	p.startsWith = parse.startsWith;
	return p;
}

const whiteSpace = rep(any([char(" "), char("\t"), char("\n")]));

function renderHeading(tok: Token, text: Str) {
	const conStart = text.val.indexOf(" ", tok.start) + 1;
	const hashes = text.val.slice(tok.start, conStart);
	const level = hashes.length - 1;
	const content = text.val.slice(conStart, tok.end);
	tok.html = `<h${level}><span class="hidden">${hashes}</span>${content}</h${level}>`;
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
const italic = render(
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
	im.startsWith = [""];
	inlines.push(im);
	inlines.push(untilStr("\n", true, true));
	return rep(any(inlines));
}

const heading = render(
	run([
		run([rep(char("#"), 1, 6), char(" ")]),
		// inline(),
		untilStr("\n", true, true),
	]),
	"heading",
	false,
	renderHeading,
);
const toNewline = until(char("\n"), true, true);
const blocks = any([heading]);
const blocksPreChecked = check(blocks, (text, index) => {
	if (index === 0 || text.val[index - 1] === "\n") return true;
	else return false;
});

const smallParser = rep(
	render(
		until(any([rep(char("\n"), 2, 2), blocksPreChecked]), true, true),
		"paragraph",
		false,
		renderParagraph,
	),
);
const fullParser: Parser = (text: Str, index: number): Token | null => {
	const tokens: Token[] = [];
	const start = index;
	let checkBlocks = true;
	let para: Token = { name: "paragraph", start: 0, end: 0, len: 0 };
	while (index < text.val.length) {
		let tok = blocks(text, index);
		if (tok) {
			index = tok.end;
			if (para.len > 0) {
				tokens.push(para);
				para = { name: "paragraph", start: index, end: index, len: 0 };
			}
			tokens.push(tok);
		} else {
			tok = toNewline(text, index);
			if (tok) {
				if (para.start === 0 && index > 0) para.start = index;
				index = tok.end;
				para.end = tok.end;
				para.len += tok.len;
				if (text.val[index] === "\n" || index === text.val.length) {
					if (text.val[index] === "\n") {
						index++;
						para.end++;
						para.len++;
					}
					renderParagraph(para, text);
					tokens.push(para);
					para = { name: "paragraph", start: index, end: index, len: 0 };
				}
			}
		}
	}
	const html = renderTokens(tokens);
	return {
		start,
		end: index,
		len: index - start,
		name: "root",
		tokens,
		html,
	};
};
fullParser.startsWith = [];

markdown.val = "# Jotter!\n".repeat(1);
markdown.saveToks = false;

const perfStart = performance.now();
const result = fullParser(markdown, 0);
const perfEnd = performance.now();

// console.log(result);
// console.log(result.html);
// console.log(JSON.stringify(result, null, 2));
console.log(`Parsed Tokens: ${result!.tokens?.length.toLocaleString() ?? 0}`);
console.log(`Markdown Length: ${markdown.val.length.toLocaleString()}`);
console.log(`Time: ${(perfEnd - perfStart).toFixed(2)}ms`);
