export type HTMLTokenType = "StartTag" | "EndTag" | "Text" | "Comment";

export interface HTMLToken {
  type: HTMLTokenType;
  tagName?: string;
  attributes?: Record<string, string>;
  selfClosing?: boolean;
  text?: string;
}

const SELF_CLOSING_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const ATTR_REGEX =
  /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const NUM_ENTITY_REGEX = /&#(\d+);/g;
const HEX_ENTITY_REGEX = /&#x([0-9a-fA-F]+);/g;

export function decodeHtmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(NUM_ENTITY_REGEX, (_, code) =>
      String.fromCharCode(parseInt(code, 10)),
    )
    .replace(HEX_ENTITY_REGEX, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

export class HTMLTokenizer {
  private pos = 0;

  constructor(private readonly html: string) {}

  tokenize(): HTMLToken[] {
    const tokens: HTMLToken[] = [];
    const len = this.html.length;

    while (this.pos < len) {
      if (this.html.startsWith("<!--", this.pos)) {
        // Comment
        const endIdx = this.html.indexOf("-->", this.pos + 4);
        if (endIdx === -1) {
          tokens.push({ type: "Comment", text: this.html.slice(this.pos + 4) });
          break;
        }
        tokens.push({
          type: "Comment",
          text: this.html.slice(this.pos + 4, endIdx),
        });
        this.pos = endIdx + 3;
      } else if (this.html[this.pos] === "<") {
        if (this.html.startsWith("</", this.pos)) {
          // End tag
          const endIdx = this.html.indexOf(">", this.pos);
          if (endIdx === -1) break;
          const tagName = this.html
            .slice(this.pos + 2, endIdx)
            .trim()
            .toLowerCase();
          tokens.push({ type: "EndTag", tagName });
          this.pos = endIdx + 1;
        } else {
          // Start tag or self-closing tag
          const endIdx = this.html.indexOf(">", this.pos);
          if (endIdx === -1) break;

          let rawTag = this.html.slice(this.pos + 1, endIdx).trim();
          let isSelfClosing = rawTag.endsWith("/");
          if (isSelfClosing) rawTag = rawTag.slice(0, -1).trim();

          const firstSpace = rawTag.search(/\s/);
          let tagName = "";
          let attrString = "";

          if (firstSpace === -1) {
            tagName = rawTag.toLowerCase();
          } else {
            tagName = rawTag.slice(0, firstSpace).toLowerCase();
            attrString = rawTag.slice(firstSpace + 1);
          }

          if (SELF_CLOSING_TAGS.has(tagName)) {
            isSelfClosing = true;
          }

          const attributes = this.parseAttributes(attrString);
          tokens.push({
            type: "StartTag",
            tagName,
            attributes,
            selfClosing: isSelfClosing,
          });

          this.pos = endIdx + 1;
        }
      } else {
        // Text node
        const nextTagIdx = this.html.indexOf("<", this.pos);
        let rawText = "";
        if (nextTagIdx === -1) {
          rawText = this.html.slice(this.pos);
          this.pos = len;
        } else {
          rawText = this.html.slice(this.pos, nextTagIdx);
          this.pos = nextTagIdx;
        }

        const decoded = decodeHtmlEntities(rawText);
        if (decoded.length > 0) {
          tokens.push({ type: "Text", text: decoded });
        }
      }
    }

    return tokens;
  }

  private parseAttributes(attrString: string): Record<string, string> {
    if (!attrString) return {};
    const attrs: Record<string, string> = {};
    ATTR_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ATTR_REGEX.exec(attrString)) !== null) {
      const name = match[1]?.toLowerCase();
      if (!name) continue;
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      attrs[name] = decodeHtmlEntities(value);
    }

    return attrs;
  }
}
