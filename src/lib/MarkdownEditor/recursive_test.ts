import { char, seqG, seq, alt, many, lazy, not, map, until } from "./Parser";
import type { Parser } from "./Parser";

/**
 * This example demonstrates recursive parsing of nested parentheses.
 *
 * We use `lazy` to allow `content` and `nested` to refer to each other.
 * We use `not` to ensure we stop at a closing parenthesis.
 * We use `map` to visualize the tree structure in the output.
 */

// A parser for ( ... ) which recursively parses its content
const nested: Parser = map(
	seqG([char("("), lazy(() => content), char(")")]),
	(results) => {
		// results is an array of strings from the successful parsers in seqG
		// the first is '(', the last is ')', and the middle is the flattened content
		return [`NESTED(${results.join("")})`];
	},
);

// A parser for text that is NOT a closing parenthesis
const text: Parser = seqG([not(char(")")), char()]);

// The combined parser which handles either a nested block or a single character
const content: Parser = many(alt([nested, text]));

// --- Test Case ---
const input = "a(b(c)d)e";
const [result, length] = content(input, 0);

console.log("Input:", input);
console.log("Consumed Length:", length);
console.log(
	"Result (Flattened/Mapped String Array):",
	JSON.stringify(result, null, 2),
);

/**
 * Expected output:
 * [
 *   "a",
 *   "NESTED((bNESTED((c))d))",
 *   "e"
 * ]
 */
