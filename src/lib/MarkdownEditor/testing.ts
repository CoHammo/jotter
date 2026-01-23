import { Token, Doc, TokenMaker } from "./index";

const HeaderMaker = {
	marker: "#",
	start: -1,
	markersFound: 0,
	possible: false,
	consecutiveMarkers: false,
	foundMarker(index: number) {
		this.markersFound++;
		if (this.markersFound == 1) {
			this.start = index;
		}
		this.consecutiveMarkers = true;
		this.possible = true;
	},
	next(char: string, index: number) {
		if (this.consecutiveMarkers) {
			if (char == "#") {
				this.markersFound++;
				if (this.markersFound > 6) {
					this.reset();
					return { continue: false, isToken: false };
				} else {
					return { continue: true, isToken: false };
				}
			} else if (char == " ") {
				this.consecutiveMarkers = false;
				return { continue: true, isToken: true };
			} else {
				this.reset();
				return { continue: false, isToken: false };
			}
		} else if (char == "\n") {
			return { continue: false, isToken: true };
		} else {
			return { continue: true, isToken: true };
		}
	},
	reset() {
		this.start = -1;
		this.markersFound = 0;
		this.consecutiveMarkers = false;
		this.possible = false;
	},
};
Token.addMaker(HeaderMaker);

let markdown = "# Jotter!\n".repeat(1000000);

let perfStart = performance.now();
let doc = new Doc(markdown);
let perfEnd = performance.now();

let perf = perfEnd - perfStart;
// console.log(JSON.stringify(doc, null, "  "));
// console.log(doc.toString());
console.log(markdown.length.toLocaleString());
console.log(`${perf.toFixed(2)}ms`);
