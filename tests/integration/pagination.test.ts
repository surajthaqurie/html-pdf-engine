import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/index.js";
import { CSSParser } from "../../src/css/parser.js";
import { CascadeEngine } from "../../src/css/cascade.ts";
import { HTMLParser } from "../../src/html/parser.ts";

describe("Phase 12 — Advanced PDF Pagination & Page-Break Control", () => {
  describe("CSS Property Cascading & Normalization", () => {
    it("parses break-before: page and page-break-before: always", () => {
      const css = `
        .break-modern { break-before: page; }
        .break-legacy { page-break-before: always; }
        .break-auto { break-before: auto; }
      `;
      const parser = new CSSParser();
      const rules = parser.parse(css);
      const cascade = new CascadeEngine();
      const htmlParser = new HTMLParser();

      const el1 = htmlParser.parse('<div class="break-modern"></div>').children[0]!;
      const style1 = cascade.computeStyle(el1 as any, rules);
      expect(style1.breakBefore).toBe("page");
      expect(style1.pageBreakBefore).toBe("always");

      const el2 = htmlParser.parse('<div class="break-legacy"></div>').children[0]!;
      const style2 = cascade.computeStyle(el2 as any, rules);
      expect(style2.breakBefore).toBe("page");
      expect(style2.pageBreakBefore).toBe("always");

      const el3 = htmlParser.parse('<div class="break-auto"></div>').children[0]!;
      const style3 = cascade.computeStyle(el3 as any, rules);
      expect(style3.breakBefore).toBe("auto");
      expect(style3.pageBreakBefore).toBe("auto");
    });

    it("parses break-after: page and page-break-after: always", () => {
      const css = `
        .after-modern { break-after: page; }
        .after-legacy { page-break-after: always; }
      `;
      const parser = new CSSParser();
      const rules = parser.parse(css);
      const cascade = new CascadeEngine();
      const htmlParser = new HTMLParser();

      const el1 = htmlParser.parse('<div class="after-modern"></div>').children[0]!;
      const style1 = cascade.computeStyle(el1 as any, rules);
      expect(style1.breakAfter).toBe("page");
      expect(style1.pageBreakAfter).toBe("always");

      const el2 = htmlParser.parse('<div class="after-legacy"></div>').children[0]!;
      const style2 = cascade.computeStyle(el2 as any, rules);
      expect(style2.breakAfter).toBe("page");
      expect(style2.pageBreakAfter).toBe("always");
    });

    it("parses break-inside: avoid and page-break-inside: avoid", () => {
      const css = `
        .inside-modern { break-inside: avoid; }
        .inside-legacy { page-break-inside: avoid; }
      `;
      const parser = new CSSParser();
      const rules = parser.parse(css);
      const cascade = new CascadeEngine();
      const htmlParser = new HTMLParser();

      const el1 = htmlParser.parse('<div class="inside-modern"></div>').children[0]!;
      const style1 = cascade.computeStyle(el1 as any, rules);
      expect(style1.breakInside).toBe("avoid");
      expect(style1.pageBreakInside).toBe("avoid");

      const el2 = htmlParser.parse('<div class="inside-legacy"></div>').children[0]!;
      const style2 = cascade.computeStyle(el2 as any, rules);
      expect(style2.breakInside).toBe("avoid");
      expect(style2.pageBreakInside).toBe("avoid");
    });
  });

  describe("break-before Functionality", () => {
    it("forces page break before element when placed mid-page", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 100pt;">Block 1</div>
            <div style="break-before: page; height: 50pt;">Block 2</div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });

    it("does NOT create an unnecessary extra blank page if break-before element is at document start", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="break-before: page; height: 50pt;">First Block</div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(1);
    });
  });

  describe("break-after Functionality", () => {
    it("forces subsequent content to start on the next page", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="break-after: page; height: 50pt;">Section 1</div>
            <div style="height: 50pt;">Section 2</div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });

    it("does NOT generate an extra trailing blank page when break-after is on final element", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 50pt;">Only Content</div>
            <div style="break-after: page; height: 50pt;">Final Element</div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(1);
    });
  });

  describe("break-inside: avoid Functionality", () => {
    it("moves container box to next page when it does not fit on current page", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 650pt;">Top Spacer</div>
            <div style="break-inside: avoid; height: 200pt; background-color: red;">
              <p>Card Header</p>
              <p>Card Body</p>
            </div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });

    it("allows oversized element (> 1 page height) to split across pages without infinite loop", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 500pt;">Spacer</div>
            <div style="break-inside: avoid; background-color: blue;">
              <div style="height: 400pt;">Oversized Part 1</div>
              <div style="height: 400pt;">Oversized Part 2</div>
            </div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Table Pagination Support", () => {
    it("keeps table rows together when tr has break-inside: avoid", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 700pt;">Table Top Spacer</div>
            <table style="width: 100%;">
              <tr style="break-inside: avoid;">
                <td style="height: 80pt;">Row 1 Cell 1</td>
                <td style="height: 80pt;">Row 1 Cell 2</td>
              </tr>
              <tr style="break-inside: avoid;">
                <td style="height: 80pt;">Row 2 Cell 1</td>
                <td style="height: 80pt;">Row 2 Cell 2</td>
              </tr>
            </table>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });

    it("handles legacy page-break-inside: avoid on tr", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 700pt;">Spacer</div>
            <table style="width: 100%;">
              <tr style="page-break-inside: avoid;">
                <td style="height: 120pt;">Row Cell 1</td>
              </tr>
            </table>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });
  });

  describe("Flexbox & Grid Pagination", () => {
    it("respects break-before on flex container", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 100pt;">Header</div>
            <div style="display: flex; break-before: page;">
              <div>Flex Item 1</div>
              <div>Flex Item 2</div>
            </div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });

    it("respects break-inside: avoid on flex item container", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 650pt;">Spacer</div>
            <div style="display: flex; break-inside: avoid;">
              <div style="height: 200pt;">Column A</div>
              <div style="height: 200pt;">Column B</div>
            </div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });

    it("respects break-before on grid container", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 100pt;">Top</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; break-before: page;">
              <div>Grid Cell 1</div>
              <div>Grid Cell 2</div>
            </div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });
  });

  describe("Positioned Elements & Pagination Integration", () => {
    it("correctly propagates pageIndex for relative and absolute elements with page breaks", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 100pt;">Header</div>
            <div style="break-before: page; position: relative; height: 150pt; background-color: yellow;">
              <div style="position: absolute; top: 10pt; left: 10pt;">Sticker on Page 2</div>
            </div>
          </body>
        </html>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      expect(doc.getPages().length).toBe(2);
    });
  });

  describe("Deterministic Layout & Output Integrity", () => {
    it("produces identical byte output for deterministic page break documents", async () => {
      const html = `
        <html>
          <body style="margin: 0; padding: 0;">
            <div style="height: 200pt;">Page 1 Header</div>
            <div style="break-before: page; height: 200pt;">Page 2 Content</div>
          </body>
        </html>
      `;
      const doc1 = await HtmlToPdf.generate({ html, compress: false });
      const doc2 = await HtmlToPdf.generate({ html, compress: false });
      expect(Buffer.from(doc1.save()).equals(Buffer.from(doc2.save()))).toBe(true);
    });
  });
});
