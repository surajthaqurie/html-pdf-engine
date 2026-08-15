import { describe, it, expect } from "vitest";
import { CascadeEngine } from "../../src/css/cascade.js";
import { HTMLParser } from "../../src/html/parser.js";
import { CSSParser } from "../../src/css/parser.js";
import { ElementNode } from "../../src/html/dom/node.js";

describe("CSS Cascade Engine", () => {
  it("should prioritize inline CSS style attribute over class stylesheet rule", () => {
    const html =
      '<h1 class="title" style="color: blue;">Header</h1>';
    const css = ".title { color: red; }";

    const doc = new HTMLParser().parse(html);
    const cssParser = new CSSParser();
    const rules = cssParser.parse(css);

    const cascade = new CascadeEngine();
    const element = doc.children[0];
    expect(element).toBeInstanceOf(ElementNode);

    if (element instanceof ElementNode) {
      const computed = cascade.computeStyle(element, rules);
      expect(computed.color).toEqual({ r: 0, g: 0, b: 1 }); // Blue wins from inline style
    }
  });

  it("should inherit font-family and color from parent element", () => {
    const html =
      '<div style="color: red; font-family: Courier;"><span>Child Text</span></div>';
    const doc = new HTMLParser().parse(html);

    const cascade = new CascadeEngine();
    const div = doc.children[0];
    expect(div).toBeInstanceOf(ElementNode);

    if (div instanceof ElementNode) {
      const parentComputed = cascade.computeStyle(div, []);
      const span = div.children[0];
      expect(span).toBeInstanceOf(ElementNode);
      if (span instanceof ElementNode) {
        const childComputed = cascade.computeStyle(span, [], parentComputed);
        expect(childComputed.color).toEqual({ r: 1, g: 0, b: 0 }); // Red inherited
        expect(childComputed.fontFamily).toBe("Courier"); // Courier inherited
      }
    }
  });
});
