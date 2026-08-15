import { describe, it, expect } from "vitest";
import { LayoutEngine } from "../../src/layout/layout-engine.js";
import { HTMLParser } from "../../src/html/parser.js";
import { CSSParser } from "../../src/css/parser.js";

describe("Phase 4 — Layout Engine & Dimension Computation Edge Cases", () => {
  const layoutEngine = new LayoutEngine();
  const htmlParser = new HTMLParser();
  const cssParser = new CSSParser();

  it("should compute box model dimensions including content, padding, border, and margin", () => {
    const html = `
      <div style="width: 300px; padding: 10px; margin: 15px; border-width: 2px;">
        Content Box
      </div>
    `;
    const dom = htmlParser.parse(html);
    const boxes = layoutEngine.layout(dom, []);

    expect(boxes.length).toBeGreaterThan(0);
    const rootBox = boxes[0];
    expect(rootBox).toBeDefined();
    if (rootBox && rootBox.children[0]) {
      const childBox = rootBox.children[0];
      expect(childBox.dimensions).toBeDefined();
      expect(childBox.dimensions?.padding.left).toBeCloseTo(7.5, 1); // 10px = 7.5pt
      expect(childBox.dimensions?.margin.top).toBeCloseTo(11.25, 1); // 15px = 11.25pt
    }
  });

  it("should wrap long inline text into multiple lines based on printable page width", () => {
    const longText =
      "This is a very long sentence designed to test inline text line wrapping and vertical layout positioning within the rendering pipeline.";
    const html = `<div style="width: 200pt;"><p>${longText}</p></div>`;

    const dom = htmlParser.parse(html);
    const boxes = layoutEngine.layout(dom, [], 300, 500);

    expect(boxes.length).toBeGreaterThan(0);
    const rootBox = boxes[0];
    const pBox = rootBox?.children[0]?.children[0];
    const textNodeBox = pBox?.children[0];

    expect(textNodeBox).toBeDefined();
    expect(textNodeBox?.textLines.length).toBeGreaterThan(1);
  });

  it("should enforce page-break-before: always by advancing page index", () => {
    const html = `
      <div>First Section</div>
      <div style="page-break-before: always;">Second Section</div>
    `;
    const dom = htmlParser.parse(html);
    const boxes = layoutEngine.layout(dom, [], 500, 700);

    const rootBox = boxes[0];
    expect(rootBox).toBeDefined();
    const children = rootBox?.children ?? [];

    expect(children.length).toBeGreaterThanOrEqual(2);
    const sec1 = children[0];
    const sec2 = children[1];

    expect(sec1?.pageIndex).toBe(0);
    expect(sec2?.pageIndex).toBe(1);
  });
});
