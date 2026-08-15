import { describe, it, expect } from "vitest";
import { LayoutEngine } from "../../src/layout/layout-engine.js";
import { CSSParser } from "../../src/css/parser.js";
import { HTMLParser } from "../../src/html/parser.js";
import { HtmlToPdf, PDFDocument } from "../../src/index.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Phase 10 — Practical CSS Grid Support", () => {
  const layoutEngine = new LayoutEngine();
  const cssParser = new CSSParser();
  const htmlParser = new HTMLParser();

  function layoutHtml(html: string, css: string = "") {
    const dom = htmlParser.parse(html);
    const rules = cssParser.parse(css);
    const boxes = layoutEngine.layout(dom, rules, 595.28, 841.89, {
      top: 36,
      right: 36,
      bottom: 36,
      left: 36,
    });
    return boxes[0]!;
  }

  it("1. Two-column grid (1fr 1fr)", () => {
    const html = `<div class="grid"><div>Left</div><div>Right</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 1fr 1fr; width: 500px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    expect(gridBox.children.length).toBe(2);
    const c1 = gridBox.children[0]!;
    const c2 = gridBox.children[1]!;

    // 500px * 0.75 = 375pt total width -> 187.5pt per col
    expect(c1.width).toBeCloseTo(187.5, 1);
    expect(c2.width).toBeCloseTo(187.5, 1);
    expect(c1.x).toBeCloseTo(36, 1);
    expect(c2.x).toBeCloseTo(36 + 187.5, 1);
  });

  it("2. Three-column grid (repeat(3, 1fr))", () => {
    const html = `<div class="grid"><div>A</div><div>B</div><div>C</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: repeat(3, 1fr); width: 600px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    expect(gridBox.children.length).toBe(3);
    const [c1, c2, c3] = gridBox.children;
    // 600px * 0.75 = 450pt total width -> 150pt per col
    expect(c1!.width).toBeCloseTo(150, 1);
    expect(c2!.width).toBeCloseTo(150, 1);
    expect(c3!.width).toBeCloseTo(150, 1);
  });

  it("3. Fixed + flexible columns (200px 1fr)", () => {
    const html = `<div class="grid"><div>Sidebar</div><div>Content</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 200px 1fr; width: 500px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    const [c1, c2] = gridBox.children;
    // 200px = 150pt fixed. Total = 375pt -> remaining = 225pt
    expect(c1!.width).toBe(150);
    expect(c2!.width).toBe(225);
  });

  it("4. fr units (1fr 2fr)", () => {
    const html = `<div class="grid"><div>1x</div><div>2x</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 1fr 2fr; width: 300px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    const [c1, c2] = gridBox.children;
    // 300px = 225pt. 1fr = 75pt, 2fr = 150pt
    expect(c1!.width).toBeCloseTo(75, 1);
    expect(c2!.width).toBeCloseTo(150, 1);
  });

  it("5. Percentage columns (25% 75%)", () => {
    const html = `<div class="grid"><div>25%</div><div>75%</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 25% 75%; width: 400px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    const [c1, c2] = gridBox.children;
    // 400px = 300pt. 25% = 75pt, 75% = 225pt
    expect(c1!.width).toBe(75);
    expect(c2!.width).toBe(225);
  });

  it("6. Auto columns (auto 1fr auto)", () => {
    const html = `<div class="grid"><div>Label</div><div>Flexible Main Content</div><div>Status</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: auto 1fr auto; width: 500px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    expect(gridBox.children.length).toBe(3);
    const [c1, c2, c3] = gridBox.children;
    // 500px = 375pt total
    expect(c1!.width).toBeGreaterThan(0);
    expect(c3!.width).toBeGreaterThan(0);
    expect(c2!.width).toBeCloseTo(375 - c1!.width - c3!.width, 1);
  });

  it("7. Row sizing (explicit grid-template-rows: 40px 80px)", () => {
    const html = `<div class="grid"><div>Row 1</div><div>Row 2</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 1fr; grid-template-rows: 40px 80px; width: 300px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    const [c1, c2] = gridBox.children;
    // 40px = 30pt
    expect(c1!.y).toBe(36);
    expect(c2!.y).toBe(36 + 30);
  });

  it("8. gap, row-gap, column-gap", () => {
    const html = `<div class="grid"><div>A</div><div>B</div><div>C</div><div>D</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 300px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    // 300px = 225pt. Gap = 20px = 15pt. Avail = 210pt -> colWidth = 105pt
    const [c1, c2, c3, c4] = gridBox.children;
    expect(c1!.width).toBe(105);
    expect(c2!.width).toBe(105);
    expect(c2!.x).toBe(36 + 105 + 15);
    expect(c3!.x).toBe(36);
    expect(c4!.x).toBe(36 + 105 + 15);
  });

  it("9. Explicit grid-column placement (1 / 3, span 2)", () => {
    const html = `<div class="grid"><div class="span-col">Header</div><div>A</div><div>B</div></div>`;
    const css = `
      .grid { display: grid; grid-template-columns: 1fr 1fr; width: 400px; }
      .span-col { grid-column: 1 / 3; }
    `;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    const [header, a, b] = gridBox.children;
    // 400px = 300pt total width
    expect(header!.width).toBe(300); // spans both columns
    expect(a!.width).toBe(150);
    expect(b!.width).toBe(150);
    expect(a!.y).toBeGreaterThan(header!.y);
    expect(b!.y).toBeGreaterThan(header!.y);
  });

  it("10. Explicit grid-row placement (grid-row: 1 / 3)", () => {
    const html = `<div class="grid"><div class="tall">Sidebar</div><div>Top</div><div>Bottom</div></div>`;
    const css = `
      .grid { display: grid; grid-template-columns: 100px 1fr; width: 400px; }
      .tall { grid-row: 1 / 3; }
    `;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    const [sidebar, top, bottom] = gridBox.children;
    // 100px = 75pt
    expect(sidebar!.x).toBe(36);
    expect(top!.x).toBe(36 + 75);
    expect(bottom!.x).toBe(36 + 75);
  });

  it("11. Automatic placement", () => {
    const html = `<div class="grid"><div>1</div><div>2</div><div>3</div><div>4</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 1fr 1fr; width: 200px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;

    const [c1, c2, c3, c4] = gridBox.children;
    // 200px = 150pt -> 75pt per column
    expect(c1!.x).toBe(36);
    expect(c2!.x).toBe(36 + 75);
    expect(c3!.x).toBe(36);
    expect(c4!.x).toBe(36 + 75);
    expect(c3!.y).toBe(c1!.y + c1!.height);
  });

  it("12. justify-items (start, center, end, stretch)", () => {
    const html = `<div class="grid"><div class="item">Aligned</div></div>`;
    const css = `
      .grid { display: grid; grid-template-columns: 200px; justify-items: center; width: 200px; }
      .item { width: 100px; }
    `;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;
    const item = gridBox.children[0]!;

    // 200px = 150pt cell. Item = 100px = 75pt. Centered offset = (150 - 75) / 2 = 37.5pt
    expect(item.x).toBe(36 + 37.5);
  });

  it("13. align-items (center, end)", () => {
    const html = `<div class="grid"><div class="item">Centered</div></div>`;
    const css = `
      .grid { display: grid; grid-template-columns: 200px; grid-template-rows: 100px; align-items: center; width: 200px; }
      .item { height: 40px; }
    `;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;
    const item = gridBox.children[0]!;

    // 100px row = 75pt. Item height = 40px = 30pt. Centered offset = (75 - 30) / 2 = 22.5pt
    expect(item.y).toBe(36 + 22.5);
  });

  it("14. Text wrapping inside grid cells", () => {
    const html = `<div class="grid"><div class="cell">This is a long sentence that should wrap inside the grid cell width.</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 100px; width: 100px; }`;
    const root = layoutHtml(html, css);
    const gridBox = root.children[0]!;
    const cell = gridBox.children[0]!;
    const textNode = cell.children[0]!;

    expect(textNode.textLines.length).toBeGreaterThan(1);
    for (const line of textNode.textLines) {
      expect(line.width).toBeLessThanOrEqual(75); // 100px = 75pt
    }
  });

  it("15. Images inside grid cells", async () => {
    const transparentPngBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const html = `<div class="grid"><div><img src="${transparentPngBase64}" width="50" height="50"/></div><div>Text</div></div>`;
    const css = `.grid { display: grid; grid-template-columns: 1fr 1fr; width: 200px; }`;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, css });
    expect(pdfBuffer.length).toBeGreaterThan(100);
  });

  it("16. Custom fonts inside grid cells", async () => {
    const fontPath = join(process.cwd(), "tests/fixtures/fonts/Roboto-Regular.ttf");
    if (!existsSync(fontPath)) return;

    const fontBuffer = readFileSync(fontPath);
    const html = `<div style="display: grid; grid-template-columns: 1fr 1fr; width: 400px; font-family: Roboto;"><div>Custom Font Text</div><div>Second Cell</div></div>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      fonts: {
        Roboto: { regular: fontBuffer },
      },
    });

    expect(pdfBuffer.length).toBeGreaterThan(100);
    const pdfText = pdfBuffer.toString("latin1");
    expect(pdfText).toContain("/Font");
    expect(pdfText).toContain("ToUnicode");
  });

  it("17. Hyperlinks inside grid cells", async () => {
    const html = `<div style="display: grid; grid-template-columns: 1fr 1fr; width: 400px;"><div><a href="https://example.com">Visit Link</a></div></div>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html });

    const pdfText = pdfBuffer.toString("latin1");
    expect(pdfText).toContain("/Subtype /Link");
    expect(pdfText).toContain("https://example.com");
  });

  it("18. Grid inside flex", () => {
    const html = `
      <div class="flex-container">
        <div class="grid-child">
          <div>G1</div><div>G2</div>
        </div>
      </div>
    `;
    const css = `
      .flex-container { display: flex; width: 500px; }
      .grid-child { display: grid; grid-template-columns: 1fr 1fr; width: 300px; }
    `;
    const root = layoutHtml(html, css);
    const flexContainer = root.children[0]!;
    const gridChild = flexContainer.children[0]!;

    expect(gridChild.boxType).toBe("Grid");
    expect(gridChild.children.length).toBe(2);
    // 300px = 225pt. Col 1 = 112.5pt
    expect(gridChild.children[0]!.width).toBe(112.5);
  });

  it("19. Flex inside grid", () => {
    const html = `
      <div class="grid-container">
        <div class="flex-child">
          <div>F1</div><div>F2</div>
        </div>
      </div>
    `;
    const css = `
      .grid-container { display: grid; grid-template-columns: 1fr; width: 400px; }
      .flex-child { display: flex; justify-content: space-between; width: 400px; }
    `;
    const root = layoutHtml(html, css);
    const gridContainer = root.children[0]!;
    const flexChild = gridContainer.children[0]!;

    expect(flexChild.boxType).toBe("Flex");
    expect(flexChild.children.length).toBe(2);
  });

  it("20. Multi-page grid document", async () => {
    let rowsHtml = "";
    for (let i = 0; i < 40; i++) {
      rowsHtml += `<div>Row Item ${i} Left</div><div>Row Item ${i} Right</div>`;
    }
    const html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; width: 500px;">${rowsHtml}</div>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html });

    expect(pdfBuffer.length).toBeGreaterThan(100);
  });

  it("21. Nested grid (grid inside grid)", () => {
    const html = `
      <div class="outer-grid">
        <div class="inner-grid">
          <div>Nested A</div><div>Nested B</div>
        </div>
        <div>Outer Right</div>
      </div>
    `;
    const css = `
      .outer-grid { display: grid; grid-template-columns: 2fr 1fr; width: 600px; }
      .inner-grid { display: grid; grid-template-columns: 1fr 1fr; }
    `;
    const root = layoutHtml(html, css);
    const outerGrid = root.children[0]!;
    const innerGrid = outerGrid.children[0]!;

    expect(outerGrid.children.length).toBe(2);
    expect(innerGrid.boxType).toBe("Grid");
    // 600px = 450pt. 2fr = 300pt
    expect(innerGrid.width).toBe(300);
    // 1fr = 150pt
    expect(innerGrid.children[0]!.width).toBe(150);
  });

  it("22. Flexbox regression verification", () => {
    const html = `<div style="display: flex; justify-content: space-between; width: 500px;"><div>Left</div><div>Right</div></div>`;
    const root = layoutHtml(html);
    const flexBox = root.children[0]!;

    expect(flexBox.boxType).toBe("Flex");
    expect(flexBox.children.length).toBe(2);
    expect(flexBox.children[1]!.x).toBeGreaterThan(flexBox.children[0]!.x);
  });
});
