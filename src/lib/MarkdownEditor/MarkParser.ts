import type { Token, Str } from "./Parsers";
import {
	char,
	run,
	repChar,
	rep,
	untilStr,
	repUntil,
	any,
	token,
	post,
} from "./Parsers";

function renderHashHeading(tok: Token, text: Str) {
	const contStart = text.val.indexOf(" ", tok.start) + 1;
	const hashes = text.val.slice(tok.start, contStart);
	const level = hashes.length - 1;
	const content = text.val.slice(contStart, tok.end);
	tok.html = `<h${level}><span class="peek">${hashes}</span>${content}</h${level}>`;
}

function renderLineHeading(tok: Token, text: Str) {
	const contEnd = tok.tokens![0].start;
	const level = text.val[tok.tokens![0].start] === "=" ? 1 : 2;
	tok.html = `<h${level}>${text.val.slice(tok.start, contEnd)}${tok.tokens![0].html}${text.val[tok.end - 1]}`;
}

function renderParagraph(tok: Token, text: Str) {
	tok.html = `<p>${text.val.slice(tok.start, tok.end)}</p>`;
}

export function renderTokens(text: Str, toks: Token[]) {
	if (text.result == undefined) text.result = "";
	for (let i = 0; i < toks.length; i++) {
		if (toks[i].html != undefined) text.result += toks[i].html;
	}
}

const hashHeading = token(
	run([repChar("#", 1, 6), char(" "), untilStr("\n", true)]),
	"heading",
	false,
	renderHashHeading,
);

const lineHeading = token(
	run([
		untilStr("\n"),
		token(any([repChar("-"), repChar("=")]), undefined, false, (tok, text) => {
			tok.html = `<span class="peek">${text.val.slice(tok.start, tok.end)}</span>`;
		}),
		char("\n"),
	]),
	"heading",
	false,
	renderLineHeading,
);
const blocks = any([hashHeading, lineHeading]);

export const markParse = post(
	rep(
		token(
			repUntil(
				untilStr("\n", true),
				any([blocks, char("\n")]),
				true,
				false,
				true,
			),
			undefined,
			false,
			renderParagraph,
		),
	),
	renderTokens,
);

// const markdown: Str = {
// 	val: "Jotter!\n=\nHello man\n".repeat(1),
// 	index: 0,
// 	saveToks: false,
// };

// const perfStart = performance.now();
// const result = markParse(markdown);
// const perfEnd = performance.now();

// console.log(result);
// console.log(`Markdown Length: ${markdown.val.length.toLocaleString()}`);
// console.log(`Time: ${(perfEnd - perfStart).toFixed(2)}ms`);
