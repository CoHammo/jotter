import { AIParser } from "./AIParser.ts";

const parser = new AIParser();
const markdown = `
# Heading
This is a paragraph with **bold** text.

- Item 1
- Item 2
- Item 3

Another paragraph.
`;
const tokens = parser.parse(markdown);

console.log("Tokens:", JSON.stringify(tokens, null, 2));
console.log("HTML:", parser.renderHTML(tokens));
