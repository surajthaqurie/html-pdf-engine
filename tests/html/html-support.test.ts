import { describe, it, expect } from "vitest";
import { HTMLParser } from "../../src/html/parser.js";
import { ElementNode, TextNode } from "../../src/html/dom/node.js";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";

describe("Phase 2 — Comprehensive HTML Element Support & Resilience", () => {
  const parser = new HTMLParser();

  it("should parse standard document structure (html, head, body)", () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><div>Content</div></body></html>`;
    const doc = parser.parse(html);

    expect(doc.querySelector("html")).not.toBeNull();
    expect(doc.querySelector("head")).not.toBeNull();
    expect(doc.querySelector("body")).not.toBeNull();
    expect(doc.querySelector("div")).not.toBeNull();
  });

  it("should parse headings h1 through h6 with UA default styles", async () => {
    const html = `
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <h6>Heading 6</h6>
    `;
    const pdfDoc = await HtmlToPdf.generate({ html, compress: false });
    const pdfStr = pdfDoc.save().toString("binary");

    expect(pdfStr).toContain("(Heading 1) Tj");
    expect(pdfStr).toContain("(Heading 6) Tj");
  });

  it("should parse lists (ul, ol, li) correctly", async () => {
    const html = `
      <ul>
        <li>Unordered item 1</li>
        <li>Unordered item 2</li>
      </ul>
      <ol>
        <li>Ordered item 1</li>
      </ol>
    `;
    const pdfDoc = await HtmlToPdf.generate({ html, compress: false });
    const pdfStr = pdfDoc.save().toString("binary");

    expect(pdfStr).toContain("(Unordered item 1) Tj");
    expect(pdfStr).toContain("(Ordered item 1) Tj");
  });

  it("should parse tables (table, thead, tbody, tfoot, tr, th, td)", async () => {
    const html = `
      <table>
        <thead>
          <tr><th>Item</th><th>Price</th></tr>
        </thead>
        <tbody>
          <tr><td>Widget</td><td>$10.00</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Total</td><td>$10.00</td></tr>
        </tfoot>
      </table>
    `;
    const pdfDoc = await HtmlToPdf.generate({ html, compress: false });
    const pdfStr = pdfDoc.save().toString("binary");

    expect(pdfStr).toContain("(Item) Tj");
    expect(pdfStr).toContain("(Widget) Tj");
    expect(pdfStr).toContain("($10.00) Tj");
  });

  it("should handle links (a) and text formatting (strong, b, em, i)", async () => {
    const html = `
      <p>
        Visit <a href="https://example.com">Example Site</a>.
        <strong>Bold</strong> and <em>Italic</em> text.
      </p>
    `;
    const pdfDoc = await HtmlToPdf.generate({ html, compress: false });
    const pdfStr = pdfDoc.save().toString("binary");

    expect(pdfStr).toContain("(Example Site) Tj");
    expect(pdfStr).toContain("(Bold) Tj");
    expect(pdfStr).toContain("(Italic) Tj");
  });

  it("should handle malformed HTML gracefully without throwing", () => {
    const malformed = `
      <div>
        <p>Unclosed paragraph
        <span>Unclosed span
        <unknown-tag>Custom tag</unknown-tag>
      </div>
      </span>
      </div> <!-- Extra closing tag -->
    `;
    expect(() => parser.parse(malformed)).not.toThrow();

    const doc = parser.parse(malformed);
    expect(doc.children.length).toBeGreaterThan(0);
  });
});
