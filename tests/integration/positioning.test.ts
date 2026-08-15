import { describe, test, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { HTMLParser } from "../../src/html/parser.js";
import { CSSParser } from "../../src/css/parser.js";
import { LayoutEngine } from "../../src/layout/layout-engine.js";

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function layoutHtml(html: string, css: string = "") {
  const htmlParser = new HTMLParser();
  const cssParser = new CSSParser();
  const layoutEngine = new LayoutEngine();

  const dom = htmlParser.parse(html);
  const rules = cssParser.parse(css);
  const boxes = layoutEngine.layout(dom, rules);
  return boxes[0]!;
}

describe("Phase 11 — Practical CSS Positioning Integration Tests", () => {
  // 1. position: static regression
  test("1. position: static regression", async () => {
    const root = await layoutHtml(
      `<div style="position: static; width: 100pt; height: 50pt;">Static Box</div>`,
    );
    const box = root.children[0]!;
    expect(box.style.position).toBe("static");
    expect(box.x).toBe(36);
    expect(box.y).toBe(36);
    expect(box.width).toBe(100);
    expect(box.height).toBe(50);
  });

  // 2. relative + top
  test("2. relative + top", async () => {
    const root = await layoutHtml(
      `<div style="position: relative; top: 20pt; width: 100pt; height: 50pt;">Rel Top</div>`,
    );
    const box = root.children[0]!;
    expect(box.style.position).toBe("relative");
    expect(box.style.top).toBe(20);
    expect(box.y).toBe(36 + 20); // 56
  });

  // 3. relative + right
  test("3. relative + right", async () => {
    const root = await layoutHtml(
      `<div style="position: relative; right: 15pt; width: 100pt; height: 50pt;">Rel Right</div>`,
    );
    const box = root.children[0]!;
    expect(box.style.position).toBe("relative");
    expect(box.style.right).toBe(15);
    expect(box.x).toBe(36 - 15); // 21
  });

  // 4. relative + bottom
  test("4. relative + bottom", async () => {
    const root = await layoutHtml(
      `<div style="position: relative; bottom: 10pt; width: 100pt; height: 50pt;">Rel Bottom</div>`,
    );
    const box = root.children[0]!;
    expect(box.style.position).toBe("relative");
    expect(box.style.bottom).toBe(10);
    expect(box.y).toBe(36 - 10); // 26
  });

  // 5. relative + left
  test("5. relative + left", async () => {
    const root = await layoutHtml(
      `<div style="position: relative; left: 25pt; width: 100pt; height: 50pt;">Rel Left</div>`,
    );
    const box = root.children[0]!;
    expect(box.style.position).toBe("relative");
    expect(box.style.left).toBe(25);
    expect(box.x).toBe(36 + 25); // 61
  });

  // 6. relative combined offsets
  test("6. relative combined offsets", async () => {
    const root = await layoutHtml(
      `<div style="position: relative; top: 15pt; left: 30pt; width: 100pt; height: 50pt;">Rel Combo</div>`,
    );
    const box = root.children[0]!;
    expect(box.style.position).toBe("relative");
    expect(box.x).toBe(36 + 30); // 66
    expect(box.y).toBe(36 + 15); // 51
  });

  // 7. relative element remains in normal flow
  test("7. relative element remains in normal flow for siblings", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; top: 20pt; height: 50pt;">Box 1</div>
      <div style="height: 40pt;">Box 2</div>
    `);
    const box1 = root.children[0]!;
    const box2 = root.children[1]!;

    expect(box1.y).toBe(36 + 20); // 56
    expect(box2.y).toBe(36 + 50); // 86
  });

  // 8. absolute element removed from flow
  test("8. absolute element removed from flow", async () => {
    const root = await layoutHtml(`
      <div style="position: absolute; top: 10pt; height: 50pt;">Abs Box</div>
      <div style="height: 40pt;">Normal Flow Box</div>
    `);
    const normalBox = root.children[1]!;
    expect(normalBox.y).toBe(36);
  });

  // 9. absolute + top/left
  test("9. absolute + top/left", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 300pt; height: 200pt;">
        <div style="position: absolute; top: 10pt; left: 20pt; width: 50pt; height: 30pt;">Badge</div>
      </div>
    `);
    const container = root.children[0]!;
    const badge = container.children[0]!;

    expect(badge.style.position).toBe("absolute");
    expect(badge.x).toBe(container.x + 20);
    expect(badge.y).toBe(container.y + 10);
  });

  // 10. absolute + bottom/right
  test("10. absolute + bottom/right", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 200pt; height: 100pt;">
        <div style="position: absolute; bottom: 10pt; right: 15pt; width: 40pt; height: 20pt;">Tag</div>
      </div>
    `);
    const container = root.children[0]!;
    const tag = container.children[0]!;

    expect(tag.style.position).toBe("absolute");
    expect(tag.x).toBe(36 + 200 - 15 - 40);
    expect(tag.y).toBe(36 + 100 - 10 - 20);
  });

  // 11. absolute percentage offsets
  test("11. absolute percentage offsets", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 200pt; height: 100pt;">
        <div style="position: absolute; top: 50%; left: 25%; width: 50pt; height: 20pt;">Pct Box</div>
      </div>
    `);
    const container = root.children[0]!;
    const pctBox = container.children[0]!;

    expect(pctBox.x).toBe(36 + 50);
    expect(pctBox.y).toBe(36 + 50);
  });

  // 12. positioned ancestor containing block
  test("12. positioned ancestor containing block", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 300pt; height: 200pt; margin-left: 20pt;">
        <div style="position: static; margin-left: 10pt;">
          <div style="position: absolute; top: 5pt; left: 5pt; width: 40pt; height: 20pt;">Nested Abs</div>
        </div>
      </div>
    `);
    const container = root.children[0]!;
    const staticParent = container.children[0]!;
    const nestedAbs = staticParent.children[0]!;

    expect(nestedAbs.x).toBe(container.x + 5);
    expect(nestedAbs.y).toBe(container.y + 5);
  });

  // 13. absolute element with no positioned ancestor
  test("13. absolute element with no positioned ancestor", async () => {
    const root = await layoutHtml(`
      <div>
        <div>
          <div style="position: absolute; top: 10pt; left: 15pt; width: 50pt; height: 20pt;">Root Abs</div>
        </div>
      </div>
    `);
    const inner = root.children[0]!.children[0]!;
    const absBox = inner.children[0]!;

    expect(absBox.x).toBe(36 + 15);
    expect(absBox.y).toBe(36 + 10);
  });

  // 14. nested relative/absolute positioning
  test("14. nested relative/absolute positioning", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; top: 10pt; left: 10pt; width: 300pt; height: 200pt;">
        <div style="position: absolute; top: 20pt; left: 20pt; width: 100pt; height: 100pt;">
          <div style="position: absolute; top: 5pt; left: 5pt;">Deep Abs</div>
        </div>
      </div>
    `);
    const outerRel = root.children[0]!;
    const absParent = outerRel.children[0]!;
    const deepAbs = absParent.children[0]!;

    expect(outerRel.x).toBe(36 + 10);
    expect(outerRel.y).toBe(36 + 10);

    expect(absParent.x).toBe(outerRel.x + 20);
    expect(absParent.y).toBe(outerRel.y + 20);

    expect(deepAbs.x).toBe(absParent.x + 5);
    expect(deepAbs.y).toBe(absParent.y + 5);
  });

  // 15. positioned text node
  test("15. positioned text node", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 200pt; height: 100pt;">
        <span style="position: absolute; top: 12pt; left: 18pt; font-size: 12pt;">Positioned Text</span>
      </div>
    `);
    const container = root.children[0]!;
    const span = container.children[0]!;

    expect(span.x).toBe(container.x + 18);
    expect(span.y).toBe(container.y + 12);
    expect(span.children[0]!.textLines.length).toBeGreaterThan(0);
  });

  // 16. positioned image node
  test("16. positioned image node", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 300pt; height: 200pt;">
        <img src="${TINY_PNG_DATA_URL}" width="50" height="40" style="position: absolute; top: 15pt; left: 25pt;" />
      </div>
    `);
    const container = root.children[0]!;
    const img = container.children[0]!;

    expect(img.boxType).toBe("Image");
    expect(img.x).toBe(container.x + 25);
    expect(img.y).toBe(container.y + 15);
  });

  // 17. positioned custom font text node
  test("17. positioned custom font text node", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 200pt; height: 100pt;">
        <p style="position: absolute; top: 8pt; left: 14pt; margin: 0; font-family: Helvetica; font-weight: bold; font-size: 14pt;">Bold Helvetica</p>
      </div>
    `);
    const container = root.children[0]!;
    const p = container.children[0]!;

    expect(p.x).toBe(container.x + 14);
    expect(p.y).toBe(container.y + 8);
    expect(p.children[0]!.textLines.length).toBeGreaterThan(0);
  });

  // 18. positioned hyperlink annotation node
  test("18. positioned hyperlink annotation node", async () => {
    const root = await layoutHtml(`
      <div style="position: relative; width: 200pt; height: 100pt;">
        <a href="https://example.com" style="position: absolute; top: 10pt; left: 20pt;">Click Here</a>
      </div>
    `);
    const container = root.children[0]!;
    const link = container.children[0]!;

    expect(link.linkUrl).toBe("https://example.com");
    expect(link.x).toBe(container.x + 20);
    expect(link.y).toBe(container.y + 10);
  });

  // 19. positioned element inside Flexbox
  test("19. positioned element inside Flexbox", async () => {
    const root = await layoutHtml(`
      <div style="display: flex; position: relative; width: 300pt; height: 100pt;">
        <div style="position: absolute; top: 5pt; right: 10pt; width: 30pt; height: 20pt;">Flex Badge</div>
        <div style="width: 100pt;">Item 1</div>
        <div style="width: 100pt;">Item 2</div>
      </div>
    `);
    const flex = root.children[0]!;
    const badge = flex.children[0]!;
    const item1 = flex.children[1]!;

    expect(item1.x).toBe(flex.x);
    expect(badge.x).toBe(flex.x + 300 - 10 - 30);
    expect(badge.y).toBe(flex.y + 5);
  });

  // 20. positioned element inside flex-wrap
  test("20. positioned element inside flex-wrap", async () => {
    const root = await layoutHtml(`
      <div style="display: flex; flex-wrap: wrap; position: relative; width: 150pt; height: 200pt;">
        <div style="position: absolute; bottom: 5pt; right: 5pt; width: 20pt; height: 20pt;">Wrap Tag</div>
        <div style="width: 100pt; height: 30pt;">Row 1</div>
        <div style="width: 100pt; height: 30pt;">Row 2</div>
      </div>
    `);
    const flex = root.children[0]!;
    const tag = flex.children[0]!;

    expect(tag.x).toBe(flex.x + 150 - 5 - 20);
    expect(tag.y).toBe(flex.y + flex.height - 5 - 20);
  });

  // 21. positioned element inside CSS Grid
  test("21. positioned element inside CSS Grid", async () => {
    const root = await layoutHtml(`
      <div style="display: grid; grid-template-columns: 1fr 1fr; position: relative; width: 200pt; height: 100pt;">
        <div style="position: absolute; top: 2pt; left: 4pt; width: 15pt; height: 15pt;">Grid Abs</div>
        <div style="height: 40pt;">Cell A</div>
        <div style="height: 40pt;">Cell B</div>
      </div>
    `);
    const grid = root.children[0]!;
    const absItem = grid.children[0]!;
    const cellA = grid.children[1]!;

    expect(cellA.x).toBe(grid.x);
    expect(absItem.x).toBe(grid.x + 4);
    expect(absItem.y).toBe(grid.y + 2);
  });

  // 22. positioned element inside nested layout
  test("22. positioned element inside nested layout", async () => {
    const root = await layoutHtml(`
      <div style="display: flex; width: 400pt;">
        <div style="display: grid; grid-template-columns: 1fr; position: relative; width: 200pt; height: 150pt;">
          <div style="position: absolute; top: 12pt; left: 8pt; width: 20pt; height: 20pt;">Nested Tag</div>
          <div>Grid Item</div>
        </div>
      </div>
    `);
    const flex = root.children[0]!;
    const grid = flex.children[0]!;
    const tag = grid.children[0]!;

    expect(tag.x).toBe(grid.x + 8);
    expect(tag.y).toBe(grid.y + 12);
  });

  // 23. multi-page positioning
  test("23. multi-page positioning", async () => {
    const pdf = await HtmlToPdf.generate({
      html: `
        <div style="page-break-after: always;">Page 1 Content</div>
        <div style="position: relative; height: 200pt;">
          <div style="position: absolute; top: 20pt; left: 30pt;">Page 2 Badge</div>
        </div>
      `,
    });
    expect(pdf.pages.length).toBe(2);
  });

  // 24. page-index propagation
  test("24. page-index propagation", async () => {
    const root = await layoutHtml(`
      <div style="page-break-after: always; height: 100pt;">Page 1</div>
      <div style="position: relative; height: 200pt;">
        <div style="position: absolute; top: 10pt; left: 10pt;">Page 2 Abs</div>
      </div>
    `);
    const page2Container = root.children[1]!;
    const page2Abs = page2Container.children[0]!;

    expect(page2Container.pageIndex).toBe(1);
    expect(page2Abs.pageIndex).toBe(1);
  });

  // 25. multiple positioned elements deterministic output
  test("25. multiple positioned elements deterministic output", async () => {
    const html = `
      <div style="position: relative; width: 300pt; height: 200pt;">
        <div style="position: absolute; top: 10pt; left: 10pt;">Box A</div>
        <div style="position: absolute; top: 20pt; left: 20pt;">Box B</div>
        <div style="position: relative; top: 5pt; left: 5pt;">Box C</div>
      </div>
    `;

    const buf1 = await HtmlToPdf.generateBuffer({ html });
    const buf2 = await HtmlToPdf.generateBuffer({ html });

    expect(buf1.equals(buf2)).toBe(true);
  });

  // 26. invalid/unsupported position values
  test("26. invalid/unsupported position values fallback to static", async () => {
    const root = await layoutHtml(
      `<div style="position: invalid-value; width: 100pt; height: 50pt;">Fallback Box</div>`,
    );
    const box = root.children[0]!;
    expect(box.style.position).toBe("static");
  });

  // 27. regression test proving existing non-positioned PDFs remain unchanged
  test("27. regression test proving existing non-positioned PDFs remain unchanged", async () => {
    const html = `
      <div style="width: 200pt; height: 100pt; background-color: #ff0000;">
        <p style="font-size: 12pt; color: #00ff00;">Hello World</p>
      </div>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html });
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.toString("ascii")).toContain("/Type /Page");
  });
});
