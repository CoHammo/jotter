import { AIParser } from "./AIParser.ts";

const parser = new AIParser();
const tests = [
    "# Valid Heading",
    "#InvalidHeading",
    "## Also Valid",
    "###NotValid",
    "#  Double Space",
    "#",
    "# ",
];

for (const t of tests) {
    try {
        console.log(`Input: "${t}"`);
        const tokens = parser.parse(t);
        console.log("HTML:", parser.renderHTML(tokens));
        console.log("Tokens:", JSON.stringify(tokens, null, 2));
    } catch (e) {
        console.error("Error parsing:", t, e);
    }
    console.log("---");
}
