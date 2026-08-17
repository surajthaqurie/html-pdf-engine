import { describe, it, expect } from "vitest";
import { LayoutEngine } from "../../src/layout/layout-engine.js";
import { HTMLParser } from "../../src/html/parser.js";
import { CSSParser } from "../../src/css/parser.js";
import { HtmlToPdf } from "../../src/index.js";
import { extractPdfText } from "../utils/pdf-text-extractor.js";

describe("Phase 3: CSS Flexbox Layout Engine Integration Tests", () => {
  const htmlParser = new HTMLParser();
  const cssParser = new CSSParser();

  it("positions items with space-between and align-items center in row layout", () => {
    const html = `
      <div class="header" style="display: flex; justify-content: space-between; align-items: center; width: 500pt;">
        <div class="logo" style="width: 100pt; height: 40pt;">Logo</div>
        <div class="meta" style="width: 150pt; height: 60pt;">Invoice Meta</div>
      </div>
    `;

    const dom = htmlParser.parse(html);
    const rules = cssParser.parse("");
    const engine = new LayoutEngine();

    const boxes = engine.layout(dom, rules, 595.28, 841.89, {
      top: 36,
      right: 36,
      bottom: 36,
      left: 36,
    });

    expect(boxes).toHaveLength(1);
    const root = boxes[0];
    const headerBox = root?.children[0];
    expect(headerBox).toBeDefined();
    expect(headerBox?.boxType).toBe("Flex");

    const logoBox = headerBox?.children[0];
    const metaBox = headerBox?.children[1];

    expect(logoBox).toBeDefined();
    expect(metaBox).toBeDefined();

    // Logo should be placed at inner left (x = 36)
    expect(logoBox?.x).toBe(36);

    // Meta should be placed at far right: 36 + 500 - 150 = 386
    expect(metaBox?.x).toBe(386);

    // Vertical centering check (align-items: center):
    // Container cross-size (max child height) is 60pt.
    // Logo height is 40pt. Y offset should be 36 + (60 - 40) / 2 = 46pt.
    expect(logoBox?.y).toBe(46);

    // Meta height is 60pt. Y offset should be 36 + (60 - 60) / 2 = 36pt.
    expect(metaBox?.y).toBe(36);
  });

  it("supports flex-direction: column with row-gap", () => {
    const html = `
      <div style="display: flex; flex-direction: column; row-gap: 15pt; width: 400pt;">
        <div style="height: 30pt;">Item 1</div>
        <div style="height: 40pt;">Item 2</div>
      </div>
    `;

    const dom = htmlParser.parse(html);
    const rules = cssParser.parse("");
    const engine = new LayoutEngine();

    const boxes = engine.layout(dom, rules);
    const flexBox = boxes[0]?.children[0];

    const item1 = flexBox?.children[0];
    const item2 = flexBox?.children[1];

    expect(item1?.y).toBe(36);
    // Item 2 Y = 36 + 30 + 15 = 81
    expect(item2?.y).toBe(81);
  });

  it("distributes space proportionally with flex-grow and flex-basis: 0", () => {
    const html = `
      <div style="display: flex; width: 300pt;">
        <div style="flex: 1 1 0pt; height: 20pt;">Col 1</div>
        <div style="flex: 2 1 0pt; height: 20pt;">Col 2</div>
      </div>
    `;

    const dom = htmlParser.parse(html);
    const rules = cssParser.parse("");
    const engine = new LayoutEngine();

    const boxes = engine.layout(dom, rules);
    const flexBox = boxes[0]?.children[0];

    const col1 = flexBox?.children[0];
    const col2 = flexBox?.children[1];

    // Col 1 width = 300 * (1/3) = 100
    // Col 2 width = 300 * (2/3) = 200
    expect(col1?.width).toBeCloseTo(100, 1);
    expect(col2?.width).toBeCloseTo(200, 1);
  });

  it("renders a full PDF using Flexbox layout", async () => {
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html: `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div><h1 style="margin:0;">ACME CORP</h1></div>
          <div><p style="margin:0;">Invoice #1001</p></div>
        </div>
      `,
      compress: false,
    });

    const pdfContent = pdfBuffer.toString("latin1");
    const extracted = extractPdfText(pdfBuffer);
    expect(extracted).toContain("ACME CORP");
    expect(extracted).toContain("Invoice #1001");
    expect(pdfContent).toContain("/PDF");
  });
});
