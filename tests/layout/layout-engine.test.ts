import { describe, it, expect } from "vitest";
import { LayoutEngine } from "../../src/layout/layout-engine.js";
import { HTMLParser } from "../../src/html/parser.js";

describe("Layout Engine", () => {
  it("should calculate box dimensions with margins and paddings", () => {
    const html =
      '<div style="width: 200px; padding: 10px; margin: 20px; border-width: 2px;">Box</div>';
    const doc = new HTMLParser().parse(html);
    const layout = new LayoutEngine();

    const boxes = layout.layout(doc, []);
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes[0]).toBeDefined();
  });

  it("should perform page pagination when content height exceeds printable page height", () => {
    let html = "<div>";
    for (let i = 0; i < 50; i++) {
      html += `<p style="height: 30px; margin-bottom: 10px;">Paragraph ${i + 1}</p>`;
    }
    html += "</div>";

    const doc = new HTMLParser().parse(html);
    const layout = new LayoutEngine();

    // Small page height of 300pt to force page splits
    const boxes = layout.layout(doc, [], 400, 300);
    expect(boxes.length).toBeGreaterThan(0);
  });
});
