export type TokenType =
    | "text"
    | "heading"
    | "bold"
    | "italic"
    | "bold_italic"
    | "code"
    | "code_block"
    | "link"
    | "list"
    | "list_item"
    | "paragraph"
    | "newline";

export interface Token {
    type: TokenType;
    text: string;
    level?: number;
    href?: string;
    children?: Token[];
}

export class AIParser {
    private tokens: Token[] = [];
    private text: string = "";
    private pos: number = 0;
    private lineStart: boolean = true;

    constructor() { }

    parse(input: string): Token[] {
        const oldText = this.text;
        const oldPos = this.pos;
        const oldTokens = this.tokens;
        const oldLineStart = this.lineStart;

        this.tokens = [];
        this.text = input;
        this.pos = 0;
        this.lineStart = true;

        this.runLoop(true);
        const result = this.tokens;

        this.text = oldText;
        this.pos = oldPos;
        this.tokens = oldTokens;
        this.lineStart = oldLineStart;

        return result;
    }

    private parseInline(input: string): Token[] {
        const oldText = this.text;
        const oldPos = this.pos;
        const oldTokens = this.tokens;
        const oldLineStart = this.lineStart;

        this.tokens = [];
        this.text = input;
        this.pos = 0;
        this.lineStart = false;

        this.runLoop(false);
        const result = this.tokens;

        this.text = oldText;
        this.pos = oldPos;
        this.tokens = oldTokens;
        this.lineStart = oldLineStart;

        return result;
    }

    private runLoop(allowBlocks: boolean) {
        while (this.pos < this.text.length) {
            const char = this.text[this.pos];

            if (allowBlocks && this.lineStart) {
                if (char === "\n") {
                    this.pos++;
                    continue;
                }

                if (char === "#") {
                    let hLevel = 0;
                    while (this.peek(hLevel) === "#" && hLevel < 6) hLevel++;
                    if (this.peek(hLevel) === " ") {
                        this.parseHeading();
                        continue;
                    }
                }

                if (
                    (char === "-" || char === "*" || char === "+") &&
                    this.peek(1) === " "
                ) {
                    this.parseList();
                    continue;
                } else if (char === "`") {
                    if (this.peek(1) === "`" && this.peek(2) === "`") {
                        this.parseCodeBlock();
                        continue;
                    }
                }
                this.parseParagraph();
                continue;
            }

            if (char === "*" || char === "_") {
                this.parseEmphasis();
            } else if (char === "`") {
                this.parseInlineCode();
            } else if (char === "[") {
                this.parseLink();
            } else if (char === "\n") {
                this.tokens.push({ type: "newline", text: "\n" });
                this.pos++;
                this.lineStart = true;
            } else {
                this.parseText();
            }
        }
    }

    private parseParagraph() {
        let start = this.pos;
        let paragraphContent = "";

        while (this.pos < this.text.length) {
            const char = this.text[this.pos];

            if (char === "\n") {
                // Check for blank line (double newline)
                if (this.peek(1) === "\n") {
                    paragraphContent += this.text.substring(start, this.pos);
                    this.pos += 1; // Consume one newline
                    break;
                }

                // Check if the NEXT line starts a block
                let nextPos = this.pos + 1;
                while (this.text[nextPos] === " " || this.text[nextPos] === "\t")
                    nextPos++;

                let nextChar = this.text[nextPos];
                let isHeading = false;
                if (nextChar === "#") {
                    let hLevel = 0;
                    while (this.text[nextPos + hLevel] === "#" && hLevel < 6)
                        hLevel++;
                    if (this.text[nextPos + hLevel] === " ") isHeading = true;
                }

                if (
                    isHeading ||
                    ((nextChar === "-" || nextChar === "*" || nextChar === "+") &&
                        this.text[nextPos + 1] === " ") ||
                    (nextChar === "`" &&
                        this.text[nextPos + 1] === "`" &&
                        this.text[nextPos + 2] === "`")
                ) {
                    paragraphContent += this.text.substring(start, this.pos);
                    break;
                }
            }

            this.pos++;
        }

        if (this.pos >= this.text.length && paragraphContent === "") {
            paragraphContent = this.text.substring(start, this.pos);
        }

        const trimmed = paragraphContent.trim();
        if (trimmed) {
            this.tokens.push({
                type: "paragraph",
                text: trimmed,
                children: this.parseInline(trimmed),
            });
        }
        this.lineStart = true;
    }

    private peek(offset: number): string {
        return this.text[this.pos + offset] || "";
    }

    private parseHeading() {
        let level = 0;
        let hstart = this.pos;
        while (this.text[this.pos] === "#" && level < 6) {
            level++;
            this.pos++;
        }

        // Optional space after #
        if (this.text[this.pos] === " ") {
            this.pos++;
        }

        let start = this.pos;
        while (this.pos < this.text.length && this.text[this.pos] !== "\n") {
            this.pos++;
        }
        let rawContent = this.text.substring(start, this.pos).trim();

        this.tokens.push({
            type: "heading",
            text: rawContent,
            level: level,
            children: this.parseInline(rawContent),
        });
        this.lineStart = true;
    }

    private parseList() {
        const items: Token[] = [];
        while (this.pos < this.text.length) {
            const char = this.text[this.pos];
            if (
                (char === "-" || char === "*" || char === "+") &&
                this.peek(1) === " "
            ) {
                items.push(this.parseListItem());

                // Peek ahead for the next item
                let nextPos = this.pos;
                // Skip one newline if it's there
                if (this.text[nextPos] === "\n") nextPos++;

                const nextChar = this.text[nextPos];
                if (
                    (nextChar === "-" || nextChar === "*" || nextChar === "+") &&
                    (this.text[nextPos + 1] === " ")
                ) {
                    this.pos = nextPos;
                    continue;
                }
                break;
            } else {
                break;
            }
        }

        if (items.length > 0) {
            this.tokens.push({
                type: "list",
                text: "",
                children: items,
            });
        }
        this.lineStart = true;
    }

    private parseListItem(): Token {
        // Consumes the marker and the space
        this.pos += 2;
        let start = this.pos;
        while (this.pos < this.text.length && this.text[this.pos] !== "\n") {
            this.pos++;
        }
        let rawContent = this.text.substring(start, this.pos).trim();
        const itemBody = {
            type: "list_item" as const,
            text: rawContent,
            children: this.parseInline(rawContent),
        };

        // Final position should be at the newline or EOF
        this.lineStart = true;
        return itemBody;
    }

    private parseCodeBlock() {
        this.pos += 3; // ```
        // Language (optional)
        let lang = "";
        while (this.pos < this.text.length && this.text[this.pos] !== "\n") {
            lang += this.text[this.pos];
            this.pos++;
        }
        if (this.text[this.pos] === "\n") this.pos++;

        let start = this.pos;
        while (this.pos < this.text.length) {
            if (
                this.text[this.pos] === "`" &&
                this.peek(1) === "`" &&
                this.peek(2) === "`"
            ) {
                const content = this.text.substring(start, this.pos);
                this.pos += 3;
                this.tokens.push({
                    type: "code_block",
                    text: content.trim(),
                });
                break;
            }
            this.pos++;
        }
        this.lineStart = true;
    }

    private parseEmphasis() {
        const char = this.text[this.pos];
        const isDouble = this.peek(1) === char;
        const isTriple = isDouble && this.peek(2) === char;

        // We try the largest possible marker first
        const markerLen = isTriple ? 3 : isDouble ? 2 : 1;
        const start = this.pos + markerLen;
        let tempPos = start;
        let foundEnd = false;

        while (tempPos < this.text.length) {
            // Respect escaping
            if (this.text[tempPos] === "\\") {
                tempPos += 2;
                continue;
            }

            if (this.text[tempPos] === char) {
                if (markerLen === 1) {
                    if (this.text[tempPos + 1] === char) {
                        // Double marker ahead, skip to stay in italic
                        tempPos += 2;
                        continue;
                    }
                }

                // Check for matching marker length
                let match = true;
                for (let i = 0; i < markerLen; i++) {
                    if (this.text[tempPos + i] !== char) {
                        match = false;
                        break;
                    }
                }

                if (match) {
                    let rawContent = this.text.substring(start, tempPos);
                    const isOnlyMarkers = /^[*_\s]*$/.test(rawContent);
                    if (rawContent.trim() !== "" && !isOnlyMarkers) {
                        this.tokens.push({
                            type:
                                markerLen === 3
                                    ? "bold_italic"
                                    : markerLen === 2
                                        ? "bold"
                                        : "italic",
                            text: rawContent,
                            children: this.parseInline(rawContent),
                        });
                        this.pos = tempPos + markerLen;
                        foundEnd = true;
                        break;
                    }
                }
            }
            tempPos++;
        }

        if (!foundEnd) {
            // Fallback: This specific marker length failed.
            // We just treat the FIRST character as text and let the next loop handle the rest.
            // This allows "***bold**" to be seen as "*" (text) + "**bold**" (bold).
            this.tokens.push({
                type: "text",
                text: char,
            });
            this.pos++;
        }
    }

    private parseInlineCode() {
        this.pos++; // `
        let start = this.pos;
        while (this.pos < this.text.length && this.text[this.pos] !== "`") {
            this.pos++;
        }
        let content = this.text.substring(start, this.pos);
        if (this.text[this.pos] === "`") this.pos++;

        this.tokens.push({
            type: "code",
            text: content,
        });
    }

    private parseLink() {
        this.pos++; // [
        let start = this.pos;
        let depth = 0;
        while (this.pos < this.text.length) {
            if (this.text[this.pos] === "\\") {
                this.pos += 2;
                continue;
            }
            if (this.text[this.pos] === "[") depth++;
            if (this.text[this.pos] === "]") {
                if (depth === 0) break;
                depth--;
            }
            this.pos++;
        }

        let linkText = this.text.substring(start, this.pos);
        if (this.text[this.pos] === "]") this.pos++;

        let href = "";
        if (this.text[this.pos] === "(") {
            this.pos++;
            let hrefStart = this.pos;
            while (this.pos < this.text.length) {
                if (this.text[this.pos] === "\\") {
                    this.pos += 2;
                    continue;
                }
                if (this.text[this.pos] === ")") break;
                this.pos++;
            }
            href = this.text.substring(hrefStart, this.pos);
            if (this.text[this.pos] === ")") this.pos++;
        }

        this.tokens.push({
            type: "link",
            text: linkText,
            href: href,
            children: this.parseInline(linkText),
        });
    }

    private parseText() {
        let content = "";
        const specialChars = ["*", "_", "`", "[", "\n"];
        let moved = false;

        while (this.pos < this.text.length) {
            const char = this.text[this.pos];

            if (char === "\\") {
                this.pos++;
                if (this.pos < this.text.length) {
                    content += this.text[this.pos];
                    this.pos++;
                }
                moved = true;
                continue;
            }

            if (char === "\n" && !this.lineStart) break;

            if (specialChars.includes(char)) {
                break;
            }

            content += char;
            this.pos++;
            moved = true;
        }

        // Safety: if we didn't move it's because we started on a special character
        // that runLoop should have handled (but didn't, e.g. unclosed marker).
        // If we still haven't moved and we're not at the end, consume ONE char.
        if (!moved && this.pos < this.text.length) {
            content = this.text[this.pos];
            this.pos++;
        }

        if (content) {
            this.tokens.push({
                type: "text",
                text: content,
            });
        }
    }

    public renderHTML(tokens: Token[]): string {
        let html = "";
        for (const token of tokens) {
            switch (token.type) {
                case "heading":
                    html += `<h${token.level}>${this.renderHTML(token.children || [])}</h${token.level}>\n`;
                    break;
                case "paragraph":
                    html += `<p>${this.renderHTML(token.children || [])}</p>\n`;
                    break;
                case "bold":
                    html += `<strong>${this.renderHTML(token.children || [])}</strong>`;
                    break;
                case "italic":
                    html += `<em>${this.renderHTML(token.children || [])}</em>`;
                    break;
                case "bold_italic":
                    html += `<strong><em>${this.renderHTML(token.children || [])}</em></strong>`;
                    break;
                case "code":
                    html += `<code>${this.escapeHTML(token.text)}</code>`;
                    break;
                case "code_block":
                    html += `<pre><code>${this.escapeHTML(token.text)}</code></pre>\n`;
                    break;
                case "link":
                    html += `<a href="${this.escapeHTML(token.href || "")}">${this.renderHTML(token.children || [])}</a>`;
                    break;
                case "list":
                    html += `<ul>\n${this.renderHTML(token.children || [])}</ul>\n`;
                    break;
                case "list_item":
                    html += `<li>${this.renderHTML(token.children || [])}</li>\n`;
                    break;
                case "newline":
                    html += "<br>\n";
                    break;
                case "text":
                    html += this.escapeHTML(token.text);
                    break;
                default:
                    if (token.children) {
                        html += this.renderHTML(token.children);
                    } else {
                        html += this.escapeHTML(token.text);
                    }
            }
        }
        return html;
    }

    private escapeHTML(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
