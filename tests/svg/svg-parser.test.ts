import { describe, it, expect } from "vitest";
import { SvgParser } from "../../src/svg/svg-parser.js";
import { SvgError } from "../../src/errors/pdf-error.js";

describe("SVG Parser", () => {
  it("parses a minimal valid svg document", () => {
    const root = new SvgParser().parse(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"></svg>`,
    );
    expect(root.tagName).toBe("svg");
    expect(root.getAttribute("width")).toBe("100");
    expect(root.getAttribute("height")).toBe("50");
  });

  it("parses nested <g> groups", () => {
    const root = new SvgParser().parse(
      `<svg><g><g><rect width="10" height="10"/></g></g></svg>`,
    );
    const outerG = root.children[0]!;
    const innerG = outerG.children[0]!;
    expect(outerG.tagName).toBe("g");
    expect(innerG.tagName).toBe("g");
    expect(innerG.children[0]!.tagName).toBe("rect");
  });

  it("parses attributes including style and class", () => {
    const root = new SvgParser().parse(
      `<svg><rect class="a b" style="fill:red" width="5" height="5"/></svg>`,
    );
    const rect = root.children[0]!;
    expect(rect.getAttribute("style")).toBe("fill:red");
    expect(rect.classList).toEqual(["a", "b"]);
  });

  it("parses viewBox attribute", () => {
    const root = new SvgParser().parse(`<svg viewBox="0 0 200 100"></svg>`);
    expect(root.getAttribute("viewBox")).toBe("0 0 200 100");
  });

  it("parses transform attribute", () => {
    const root = new SvgParser().parse(
      `<svg><g transform="translate(10,20) scale(2) rotate(45)"></g></svg>`,
    );
    expect(root.children[0]!.getAttribute("transform")).toBe(
      "translate(10,20) scale(2) rotate(45)",
    );
  });

  it("parses self-closing tags", () => {
    const root = new SvgParser().parse(`<svg><rect/><circle/><line/></svg>`);
    expect(root.children.map((c) => c.tagName)).toEqual([
      "rect",
      "circle",
      "line",
    ]);
  });

  it("ignores comments", () => {
    const root = new SvgParser().parse(`<svg><!-- comment --><rect/></svg>`);
    expect(root.children[0]!.tagName).toBe("rect");
  });

  it("ignores XML processing instructions and DOCTYPE", () => {
    const root = new SvgParser().parse(
      `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg><rect/></svg>`,
    );
    expect(root.tagName).toBe("svg");
    expect(root.children[0]!.tagName).toBe("rect");
  });

  it("decodes standard XML entities", () => {
    const root = new SvgParser().parse(`<svg><style>a > b & c</style></svg>`);
    const style = root.children[0]!;
    const textNode = style.children[0];
    if (textNode && "text" in textNode) {
      expect(textNode.text).toContain("a > b & c");
    } else {
      throw new Error("Expected TextNode");
    }
  });

  it("throws SvgError on missing root svg", () => {
    expect(() => new SvgParser().parse(`<div>not svg</div>`)).toThrow(SvgError);
  });

  it("throws SvgError on unclosed tag", () => {
    expect(() => new SvgParser().parse(`<svg><rect></svg>`)).toThrow(SvgError);
  });

  it("throws SvgError on tag mismatch", () => {
    expect(() => new SvgParser().parse(`<svg><rect></circle></svg>`)).toThrow(
      SvgError,
    );
  });

  it("throws SvgError on multiple root svg elements", () => {
    expect(() => new SvgParser().parse(`<svg/><svg/>`)).toThrow(SvgError);
  });

  it("throws SvgError on unclosed comment", () => {
    expect(() => new SvgParser().parse(`<svg><!-- never ends</svg>`)).toThrow(
      SvgError,
    );
  });

  it("rejects extremely deep nesting", () => {
    let nested = `<svg>`;
    for (let i = 0; i < 300; i++) nested += `<g>`;
    nested += `<rect/>`;
    for (let i = 0; i < 300; i++) nested += `</g>`;
    nested += `</svg>`;
    expect(() => new SvgParser().parse(nested)).toThrow(SvgError);
  });
});
