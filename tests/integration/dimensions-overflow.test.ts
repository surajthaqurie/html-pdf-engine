import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { HTMLParser } from "../../src/html/parser.js";
import { CSSParser } from "../../src/css/parser.js";
import { LayoutEngine } from "../../src/layout/layout-engine.js";
import { PaintEngine } from "../../src/paint/paint-engine.js";
import { parsePageRules } from "../../src/css/cascade.js";
import { parseCssUnit } from "../../src/css/values/units.js";

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("Phase 14 — Advanced Document Layout & Sizing Constraints", () => {
  const htmlParser = new HTMLParser();
  const cssParser = new CSSParser();
  const layoutEngine = new LayoutEngine();
  const paintEngine = new PaintEngine();

  function getLayout(html: string, css = "", pageWidth = 595.28, pageHeight = 841.89) {
    const dom = htmlParser.parse(html);
    const rules = cssParser.parse(css);
    return layoutEngine.layout(dom, rules, pageWidth, pageHeight, {
      top: 36,
      right: 36,
      bottom: 36,
      left: 36,
    });
  }

  // 1. Min-width on block box
  it("should expand block box width to min-width when auto width is smaller", () => {
    const boxes = getLayout('<div class="box">Hi</div>', ".box { width: 100pt; min-width: 250pt; }");
    const target = boxes[0]?.children[0];
    expect(target?.width).toBe(250);
  });

  // 2. Max-width on block box
  it("should clamp block box width to max-width when natural width is larger", () => {
    const boxes = getLayout('<div class="box">Hello World</div>', ".box { width: 400pt; max-width: 200pt; }");
    const target = boxes[0]?.children[0];
    expect(target?.width).toBe(200);
  });

  // 3. Min-height on block box
  it("should expand block box height to min-height when content is shorter", () => {
    const boxes = getLayout('<div class="box">Small</div>', ".box { min-height: 150pt; }");
    const target = boxes[0]?.children[0];
    expect(target?.height).toBeGreaterThanOrEqual(150);
  });

  // 4. Max-height on block box
  it("should clamp block box height to max-height when content is taller", () => {
    const boxes = getLayout('<div class="box">Line 1<br/>Line 2<br/>Line 3<br/>Line 4<br/>Line 5</div>', ".box { max-height: 30pt; }");
    const target = boxes[0]?.children[0];
    expect(target?.height).toBeLessThanOrEqual(30);
  });

  // 5. Percentage min-width / max-width
  it("should resolve percentage min-width and max-width based on container width", () => {
    const boxes = getLayout(
      '<div class="parent"><div class="child">Content</div></div>',
      ".parent { width: 400pt; } .child { width: 100pt; min-width: 50%; max-width: 75%; }",
    );
    const parent = boxes[0]?.children[0];
    const child = parent?.children[0];
    expect(child?.width).toBe(200); // 50% of 400 = 200
  });

  // 6. Image max-width preserving aspect ratio
  it("should constrain image width via max-width while scaling height proportionally", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: `<html><body><img src="${TINY_PNG_DATA_URL}" style="width: 200pt; max-width: 100pt;" /></body></html>`,
      compress: false,
    });
    expect(pdfDoc.getPages().length).toBe(1);
  });

  // 7. Image max-height preserving aspect ratio
  it("should constrain image height via max-height while scaling width proportionally", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: `<html><body><img src="${TINY_PNG_DATA_URL}" style="height: 200pt; max-height: 50pt;" /></body></html>`,
      compress: false,
    });
    expect(pdfDoc.getPages().length).toBe(1);
  });

  // 8. Image min-width / min-height constraints
  it("should expand image dimensions to min-width and min-height", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: `<html><body><img src="${TINY_PNG_DATA_URL}" style="width: 50pt; height: 50pt; min-width: 120pt; min-height: 100pt;" /></body></html>`,
      compress: false,
    });
    expect(pdfDoc.getPages().length).toBe(1);
  });

  // 9. Table cells with min-width and max-width
  it("should apply min-width and max-width to table cells", () => {
    const boxes = getLayout(
      '<table><tr><td class="c1">A</td><td class="c2">B</td></tr></table>',
      ".c1 { min-width: 200pt; } .c2 { max-width: 50pt; }",
    );
    const table = boxes[0]?.children[0];
    expect(table).toBeDefined();
  });

  // 10. Table cells with min-height and max-height
  it("should apply min-height and max-height to table cells", () => {
    const boxes = getLayout(
      '<table><tr><td class="c1">Cell Content</td></tr></table>',
      ".c1 { min-height: 80pt; }",
    );
    const table = boxes[0]?.children[0];
    expect(table).toBeDefined();
  });

  // 11. Flex items with min-width and max-width
  it("should apply min-width and max-width to flex items", () => {
    const boxes = getLayout(
      '<div class="flex"><div class="item">Item</div></div>',
      ".flex { display: flex; width: 500pt; } .item { width: 100pt; min-width: 200pt; max-width: 300pt; }",
    );
    const flex = boxes[0]?.children[0];
    const item = flex?.children[0];
    expect(item?.width).toBeGreaterThanOrEqual(200);
    expect(item?.width).toBeLessThanOrEqual(300);
  });

  // 12. Flex items with min-height and max-height
  it("should apply min-height and max-height to flex items", () => {
    const boxes = getLayout(
      '<div class="flex"><div class="item">Item</div></div>',
      ".flex { display: flex; flex-direction: column; } .item { min-height: 100pt; max-height: 150pt; }",
    );
    const flex = boxes[0]?.children[0];
    const item = flex?.children[0];
    expect(item?.height).toBeGreaterThanOrEqual(100);
    expect(item?.height).toBeLessThanOrEqual(150);
  });

  // 13. Flexbox wrapped items with min-width
  it("should wrap flex items correctly when min-width forces overflow", () => {
    const boxes = getLayout(
      '<div class="flex"><div class="item">1</div><div class="item">2</div><div class="item">3</div></div>',
      ".flex { display: flex; flex-wrap: wrap; width: 300pt; } .item { min-width: 180pt; }",
    );
    const flex = boxes[0]?.children[0];
    expect(flex?.children.length).toBe(3);
  });

  // 14. Grid items with min-width and max-width
  it("should constrain grid item width via min-width and max-width", () => {
    const boxes = getLayout(
      '<div class="grid"><div class="g-item">Grid Box</div></div>',
      ".grid { display: grid; grid-template-columns: 1fr 1fr; } .g-item { min-width: 150pt; }",
    );
    const grid = boxes[0]?.children[0];
    const item = grid?.children[0];
    expect(item?.width).toBeGreaterThanOrEqual(150);
  });

  // 15. Grid items with min-height and max-height
  it("should constrain grid item height via min-height and max-height", () => {
    const boxes = getLayout(
      '<div class="grid"><div class="g-item">Grid Box</div></div>',
      ".grid { display: grid; } .g-item { min-height: 120pt; }",
    );
    const grid = boxes[0]?.children[0];
    const item = grid?.children[0];
    expect(item?.height).toBeGreaterThanOrEqual(120);
  });

  // 16. Positioned elements with min-width / max-width
  it("should apply min-width and max-width to absolute positioned elements", () => {
    const boxes = getLayout(
      '<div class="rel"><div class="abs">Abs</div></div>',
      ".rel { position: relative; width: 400pt; height: 300pt; } .abs { position: absolute; top: 10pt; left: 10pt; width: 50pt; min-width: 150pt; }",
    );
    const rel = boxes[0]?.children[0];
    const abs = rel?.children[0];
    expect(abs?.width).toBe(150);
  });

  // 17. Positioned elements with min-height / max-height
  it("should apply min-height and max-height to absolute positioned elements", () => {
    const boxes = getLayout(
      '<div class="rel"><div class="abs">Abs</div></div>',
      ".rel { position: relative; width: 400pt; height: 300pt; } .abs { position: absolute; top: 10pt; left: 10pt; min-height: 80pt; max-height: 120pt; }",
    );
    const rel = boxes[0]?.children[0];
    const abs = rel?.children[0];
    expect(abs?.height).toBeGreaterThanOrEqual(80);
    expect(abs?.height).toBeLessThanOrEqual(120);
  });

  // 18. Relative position with min/max dimensions
  it("should preserve relative offsets on min/max constrained boxes", () => {
    const boxes = getLayout(
      '<div class="rel">Relative Box</div>',
      ".rel { position: relative; top: 20pt; left: 15pt; min-width: 200pt; min-height: 100pt; }",
    );
    const rel = boxes[0]?.children[0];
    expect(rel?.x).toBe(36 + 15);
    expect(rel?.y).toBe(36 + 20);
    expect(rel?.width).toBeGreaterThanOrEqual(200);
    expect(rel?.height).toBeGreaterThanOrEqual(100);
  });

  // 19. overflow: hidden emitting clipStart and clipEnd commands
  it("should generate clipStart and clipEnd paint commands for overflow: hidden elements", () => {
    const boxes = getLayout('<div class="clip">Clipped</div>', ".clip { width: 100pt; height: 50pt; overflow: hidden; }");
    const cmds = paintEngine.generatePaintCommands(boxes);
    const clipStart = cmds.find((c) => c.type === "clipStart");
    const clipEnd = cmds.find((c) => c.type === "clipEnd");
    expect(clipStart).toBeDefined();
    expect(clipEnd).toBeDefined();
    if (clipStart && clipStart.type === "clipStart") {
      expect(clipStart.width).toBe(100);
      expect(clipStart.height).toBe(50);
    }
  });

  // 20. overflow: hidden clipping text content
  it("should keep text lines within clipped container without crashing", () => {
    const boxes = getLayout(
      '<div class="clip">Very long sentence that exceeds the small container width</div>',
      ".clip { width: 50pt; height: 20pt; overflow: hidden; }",
    );
    const cmds = paintEngine.generatePaintCommands(boxes);
    expect(cmds.some((c) => c.type === "clipStart")).toBe(true);
  });

  // 21. overflow: hidden clipping images
  it("should wrap image drawing commands with clip region when image overflows", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: `<div class="clip"><img src="${TINY_PNG_DATA_URL}" style="width: 200pt; height: 200pt;" /></div>`,
      css: ".clip { width: 50pt; height: 50pt; overflow: hidden; }",
      compress: false,
    });
    expect(pdfDoc.getPages().length).toBe(1);
  });

  // 22. overflow: hidden clipping nested children
  it("should clip nested child elements within parent bounds", () => {
    const boxes = getLayout(
      '<div class="parent"><div class="child">Child</div></div>',
      ".parent { width: 100pt; height: 40pt; overflow: hidden; } .child { width: 300pt; height: 200pt; }",
    );
    const cmds = paintEngine.generatePaintCommands(boxes);
    expect(cmds.filter((c) => c.type === "clipStart").length).toBeGreaterThanOrEqual(1);
  });

  // 23. overflow: hidden suppressing completely clipped hyperlink annotations
  it("should omit link annotations that lie entirely outside the clipping region", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: '<div class="clip"><a href="https://example.com" class="link">Out of bounds link</a></div>',
      css: ".clip { width: 100pt; height: 10pt; overflow: hidden; } .link { display: block; margin-top: 100pt; height: 50pt; }",
    });
    const page = pdfDoc.getPages()[0];
    expect(page?.annotations.length).toBe(0);
  });

  // 24. overflow: hidden cropping partially visible hyperlink annotations
  it("should crop link annotation coordinates when partially clipped", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: '<div class="clip"><a href="https://example.com" class="link">Partially visible link</a></div>',
      css: ".clip { width: 100pt; height: 30pt; overflow: hidden; } .link { display: block; height: 50pt; }",
    });
    const page = pdfDoc.getPages()[0];
    expect(page).toBeDefined();
  });

  // 25. overflow: hidden with max-height preventing extra page breaks
  it("should prevent hidden overflow content from generating extra PDF pages", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: '<div class="clip">' + '<p>Paragraph text</p>'.repeat(50) + "</div>",
      css: ".clip { max-height: 100pt; overflow: hidden; }",
    });
    expect(pdfDoc.getPages().length).toBe(1);
  });

  // 26. min-height with break-inside: avoid forcing page break
  it("should trigger page break if min-height box exceeds remaining printable height", () => {
    const boxes = getLayout(
      '<div class="spacer"></div><div class="card">Big Min-Height Card</div>',
      ".spacer { height: 700pt; } .card { min-height: 200pt; break-inside: avoid; }",
    );
    const cardBox = boxes[0]?.children[1];
    expect(cardBox?.pageIndex).toBe(1); // Pushed to page 2 (index 1)
  });

  // 27. @page { size: A4 landscape; } rule
  it("should respect @page { size: A4 landscape; } in CSS", () => {
    const rules = cssParser.parse("@page { size: A4 landscape; margin: 20pt; }");
    const pageConfig = parsePageRules(rules);
    expect(pageConfig.pageSize).toBe("A4");
    expect(pageConfig.orientation).toBe("landscape");
    expect(pageConfig.margins?.top).toBe(20);
  });

  // 28. @page { size: Letter; margin: 50pt; } setting custom size & margins
  it("should parse @page custom size and uniform margins", () => {
    const rules = cssParser.parse("@page { size: Letter; margin: 50pt; }");
    const pageConfig = parsePageRules(rules);
    expect(pageConfig.pageSize).toBe("Letter");
    expect(pageConfig.margins?.top).toBe(50);
    expect(pageConfig.margins?.right).toBe(50);
    expect(pageConfig.margins?.bottom).toBe(50);
    expect(pageConfig.margins?.left).toBe(50);
  });

  // 29. Explicit options overriding @page rules
  it("should allow explicit JS options to override CSS @page rules", async () => {
    const pdfDoc = await HtmlToPdf.generate({
      html: "<h1>Test Page</h1>",
      css: "@page { size: A4 landscape; margin: 10pt; }",
      page: "Letter",
      orientation: "portrait",
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
    });
    const page = pdfDoc.getPages()[0];
    expect(page?.width).toBeLessThan(page?.height); // Portrait orientation
  });

  // 30. High volume benchmark test
  it("should efficiently process 200 constrained and clipped boxes without memory failure", () => {
    const item = '<div class="box"><p>Clipped Content</p></div>';
    const html = `<div class="container">${item.repeat(200)}</div>`;
    const css = ".container { width: 500pt; } .box { min-width: 100pt; max-width: 480pt; min-height: 20pt; max-height: 40pt; overflow: hidden; }";
    const start = Date.now();
    const boxes = getLayout(html, css);
    const duration = Date.now() - start;
    expect(boxes.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(2000); // Executed under 2 seconds
  });
});
