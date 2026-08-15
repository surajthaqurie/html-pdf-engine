import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/index.js";
import { LayoutEngine } from "../../src/layout/layout-engine.js";
import { HTMLParser } from "../../src/html/parser.js";
import { CSSParser } from "../../src/css/parser.js";
import { createMinimalTTFBuffer } from "../fonts/ttf-parser.test.js";

describe("Phase 8 — Practical CSS Flexbox Wrapping Suite", () => {
  const htmlParser = new HTMLParser();
  const cssParser = new CSSParser();

  function getFlexBox(html: string) {
    const dom = htmlParser.parse(html);
    const rules = cssParser.parse("");
    const engine = new LayoutEngine();
    const boxes = engine.layout(dom, rules, 595.28, 841.89, {
      top: 36,
      right: 36,
      bottom: 36,
      left: 36,
    });
    return boxes[0]?.children[0]!;
  }

  it("1. nowrap regression — default and explicit flex-wrap: nowrap maintains single line", () => {
    const html = `
      <div style="display: flex; flex-wrap: nowrap; width: 200pt;">
        <div style="width: 150pt; height: 30pt;">Item 1</div>
        <div style="width: 150pt; height: 30pt;">Item 2</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    expect(flexBox).toBeDefined();
    expect(flexBox.children.length).toBe(2);
    // Both items remain in a single line (same Y)
    expect(flexBox.children[0]?.y).toBe(flexBox.children[1]?.y);
  });

  it("2. row + wrap — items wrap to second line when width exceeds container", () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap; width: 300pt;">
        <div style="width: 200pt; height: 40pt;">Item 1</div>
        <div style="width: 150pt; height: 50pt;">Item 2</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const item1 = flexBox.children[0]!;
    const item2 = flexBox.children[1]!;

    expect(item1.y).toBeLessThan(item2.y);
    expect(item2.x).toBe(flexBox.x);
  });

  it("3. row + wrap + gap — wrapping respects column-gap and row-gap", () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap; column-gap: 20pt; row-gap: 30pt; width: 300pt;">
        <div style="width: 140pt; height: 40pt;">Item 1</div>
        <div style="width: 140pt; height: 40pt;">Item 2</div>
        <div style="width: 140pt; height: 40pt;">Item 3</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const item1 = flexBox.children[0]!;
    const item2 = flexBox.children[1]!;
    const item3 = flexBox.children[2]!;

    // Item 1 and Item 2 fit on Line 0 (140 + 20 + 140 = 300)
    expect(item1.y).toBe(item2.y);
    expect(item2.x - (item1.x + item1.width)).toBe(20);

    // Item 3 wraps to Line 1 with row-gap of 30pt
    expect(item3.y - (item1.y + item1.height)).toBe(30);
  });

  it("4. multiple flex lines — generates 3 distinct lines for wrapped items", () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap; width: 100pt; row-gap: 10pt;">
        <div style="width: 90pt; height: 20pt;">Line 1</div>
        <div style="width: 90pt; height: 20pt;">Line 2</div>
        <div style="width: 90pt; height: 20pt;">Line 3</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const item1 = flexBox.children[0]!;
    const item2 = flexBox.children[1]!;
    const item3 = flexBox.children[2]!;

    expect(item1.y).toBeLessThan(item2.y);
    expect(item2.y).toBeLessThan(item3.y);
  });

  it("5. row-reverse + wrap — items reversed within lines and wrapped top-to-bottom", () => {
    const html = `
      <div style="display: flex; flex-direction: row-reverse; flex-wrap: wrap; width: 200pt;">
        <div style="width: 120pt; height: 30pt;">First Item</div>
        <div style="width: 120pt; height: 30pt;">Second Item</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const item1 = flexBox.children[0]!;
    const item2 = flexBox.children[1]!;

    // Second Item is placed on Line 0, First Item wraps to Line 1
    expect(item2.y).toBeLessThan(item1.y);
  });

  it("6. column + wrap where practical — column flex items wrap to next column when height constrained", () => {
    const html = `
      <div style="display: flex; flex-direction: column; flex-wrap: wrap; height: 80pt; column-gap: 25pt;">
        <div style="width: 60pt; height: 50pt;">Col 1</div>
        <div style="width: 60pt; height: 50pt;">Col 2</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const item1 = flexBox.children[0]!;
    const item2 = flexBox.children[1]!;

    expect(item1.x).toBeLessThan(item2.x);
    expect(item2.x - (item1.x + item1.width)).toBe(25);
  });

  it("7. wrap-reverse — places flex lines in reversed cross-axis order", () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap-reverse; width: 200pt;">
        <div style="width: 150pt; height: 40pt;">Line A</div>
        <div style="width: 150pt; height: 40pt;">Line B</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const item1 = flexBox.children[0]!;
    const item2 = flexBox.children[1]!;

    expect(item2.y).toBeLessThan(item1.y);
  });

  it("8. justify-content on wrapped lines — each line independently resolves space distribution", () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; width: 300pt;">
        <div style="width: 100pt; height: 30pt;">L1-A</div>
        <div style="width: 100pt; height: 30pt;">L1-B</div>
        <div style="width: 250pt; height: 30pt;">L2-A</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const l1a = flexBox.children[0]!;
    const l1b = flexBox.children[1]!;

    expect(l1a.x).toBe(flexBox.x);
    expect(l1b.x).toBe(flexBox.x + 200);
  });

  it("9. align-items on wrapped lines — aligns items against each line's cross size", () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap; align-items: flex-end; width: 250pt;">
        <div style="width: 100pt; height: 60pt;">Tall Item</div>
        <div style="width: 100pt; height: 20pt;">Short Item</div>
      </div>
    `;
    const flexBox = getFlexBox(html);

    const tall = flexBox.children[0]!;
    const short = flexBox.children[1]!;

    expect(tall.y).toBe(flexBox.y);
    expect(short.y).toBe(flexBox.y + 40);
  });

  it("10. image inside wrapped flex item — renders image XObject inside wrapped container", async () => {
    const pngBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const html = `
      <div style="display: flex; flex-wrap: wrap; width: 200pt;">
        <div style="width: 150pt; height: 50pt;">Box 1</div>
        <div style="width: 150pt;">
          <img src="${pngBase64}" style="width: 40pt; height: 40pt;" />
        </div>
      </div>
    `;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
    expect(pdfStr).toContain("/Filter /FlateDecode");
  });

  it("11. custom font inside wrapped flex item — renders searchable Unicode text with custom TTF font", async () => {
    const fontBuffer = createMinimalTTFBuffer("Inter-Regular");
    const html = `
      <div style="display: flex; flex-wrap: wrap; width: 200pt; font-family: Inter;">
        <div style="width: 150pt; height: 30pt;">Header Text</div>
        <div style="width: 150pt; height: 30pt;">Wrapped Custom Font Content</div>
      </div>
    `;
    const buffer = await HtmlToPdf.generateBuffer({
      html,
      compress: false,
      fonts: {
        Inter: { regular: fontBuffer },
      },
    });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).toContain("/CIDFontType2");
    expect(pdfStr).toContain("/ToUnicode");
  });

  it("12. wrapped hyperlink — generates clickable PDF link annotation at expected position", async () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap; width: 200pt;">
        <div style="width: 150pt; height: 30pt;">Top Line</div>
        <div style="width: 150pt;">
          <a href="https://flex-link.com">Clickable Wrapped Link</a>
        </div>
      </div>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    const page = doc.getPages()[0];
    expect(page).toBeDefined();

    expect(page!.annotations.length).toBe(1);
    expect(page!.annotations[0]!.uri).toBe("https://flex-link.com");

    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");
    expect(pdfStr).toContain("/Subtype /Link");
    expect(pdfStr).toContain("/URI (https://flex-link.com)");
  });

  it("13. wrapped flex layout across multiple PDF pages — breaks across pages without duplicating content", async () => {
    const html = `
      <div style="display: flex; flex-wrap: wrap; width: 300pt; row-gap: 20pt;">
        <div style="width: 250pt; height: 450pt;">Page 1 Top Block</div>
        <div style="width: 250pt; height: 400pt;">
          <a href="https://page2-flex.com">Page 2 Link Item</a>
        </div>
      </div>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    const pages = doc.getPages();

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[1]?.annotations.length).toBe(1);
    expect(pages[1]?.annotations[0]?.uri).toBe("https://page2-flex.com");
  });
});
