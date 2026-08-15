import { describe, it, expect } from "vitest";
import { HTMLTokenizer } from "../../src/html/tokenizer.js";
import { HTMLParser } from "../../src/html/parser.js";
import { NodeType, ElementNode, TextNode } from "../../src/html/dom/node.js";

describe("HTML Tokenizer & DOM Parser", () => {
  it("should tokenize standard HTML start and end tags", () => {
    const html = '<div class="card"><h1>Hello</h1></div>';
    const tokenizer = new HTMLTokenizer(html);
    const tokens = tokenizer.tokenize();

    expect(tokens.length).toBeGreaterThan(0);
    const startDiv = tokens.find(
      (t) => t.type === "StartTag" && t.tagName === "div",
    );
    expect(startDiv).toBeDefined();
    if (startDiv && startDiv.type === "StartTag" && startDiv.attributes) {
      expect(startDiv.attributes["class"]).toBe("card");
    }
  });

  it("should decode standard HTML entities in text nodes", () => {
    const html = "<p>Tom &amp; Jerry &lt;3 &quot;Cats&quot;</p>";
    const parser = new HTMLParser();
    const doc = parser.parse(html);

    const p = doc.children[0];
    expect(p).toBeInstanceOf(ElementNode);
    if (p instanceof ElementNode) {
      const textNode = p.children[0];
      expect(textNode).toBeInstanceOf(TextNode);
      if (textNode instanceof TextNode) {
        expect(textNode.text).toBe('Tom & Jerry <3 "Cats"');
      }
    }
  });

  it("should parse embedded <style> tags cleanly", () => {
    const html = "<style>h1 { color: red; }</style>";
    const parser = new HTMLParser();
    const doc = parser.parse(html);

    const styleNode = doc.children[0];
    expect(styleNode).toBeInstanceOf(ElementNode);
    if (styleNode instanceof ElementNode) {
      expect(styleNode.tagName).toBe("style");
      const textNode = styleNode.children[0];
      expect(textNode).toBeInstanceOf(TextNode);
      if (textNode instanceof TextNode) {
        expect(textNode.text).toContain("h1 { color: red; }");
      }
    }
  });

  it("should handle empty or whitespace HTML strings without throwing", () => {
    const parser = new HTMLParser();
    const doc = parser.parse("");
    expect(doc).toBeDefined();
    expect(doc.nodeType).toBe(NodeType.DOCUMENT);
    expect(doc.children.length).toBe(0);
  });

  it("should handle malformed or unclosed HTML tags gracefully", () => {
    const html = "<div><h1>Title<p>Paragraph text";
    const parser = new HTMLParser();
    const doc = parser.parse(html);
    expect(doc).toBeDefined();
    expect(doc.children.length).toBeGreaterThan(0);
  });
});
