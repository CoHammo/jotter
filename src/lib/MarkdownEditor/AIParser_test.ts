import { AIParser } from "./AIParser.ts";

// const markdown = `
// # Heading 1
// ## Heading 2
//  This is a **bold** and *italic* text.
//  *italic and **bold** inside it.*
// Here is some \`inline code\`.
// [Jotter](https://github.com/cohammo/jotter)
// - List item 1
// - List item 2

// \`\`\`typescript
// const x = 10;
// \`\`\`
// `.repeat(50000);

// const markdown = (
// 	Deno.readTextFileSync(
// 		"/mnt/ssd/CodeProjects/jotter/src/routes/initmark.md",
// 	) as string
// ).repeat(1200);

const markdown = "# Jotter!\n".repeat(1);

const parser = new AIParser();
let perfStart = performance.now();
const tokens = parser.parse(markdown);
let perfEnd = performance.now();
let perf = perfEnd - perfStart;
console.log("Tokens:", JSON.stringify(tokens, null, 2));
// console.log("HTML:", parser.renderHTML(tokens));
console.log("Length:", markdown.length.toLocaleString());
console.log(`${perf.toFixed(2)}ms`);
