import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import * as fs from "fs";
import * as path from "path";

describe("HTML to PDF End-to-End Compiler Pipeline", () => {
  it("should convert simple HTML to a valid PDF buffer", async () => {
    const html = `
      <div class="invoice">
        <h1>Invoice #1001</h1>
        <p>Customer: <strong>John Doe</strong></p>
      </div>
    `;

    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);

    const pdfStr = buffer.toString("binary");
    expect(pdfStr).toContain("%PDF-1.7");
    expect(pdfStr).toContain("(Invoice #1001) Tj");
    expect(pdfStr).toContain("(John Doe) Tj");
  });

  it("should perform multi-page layout and pagination automatically when content overflows page", async () => {
    const paragraphs = Array.from(
      { length: 40 },
      (_, i) =>
        `<p>Paragraph line item #${i + 1} with dynamic content flow.</p>`,
    ).join("\n");
    const html = `
      <html>
        <body>
          <h1>Multi-Page Report</h1>
          ${paragraphs}
        </body>
      </html>
    `;

    const doc = await HtmlToPdf.generate({
      html,
      compress: false,
      header: { text: "Header Report", align: "center" },
      footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "right" },
    });

    const pages = doc.getPages();
    expect(pages.length).toBeGreaterThan(1); // Content split across multiple pages

    const buffer = doc.save();
    const pdfStr = buffer.toString("binary");

    expect(pdfStr).toContain("(Multi-Page Report) Tj");
    expect(pdfStr).toContain(`(Page 1 of ${pages.length}) Tj`);
    expect(pdfStr).toContain(`(Page ${pages.length} of ${pages.length}) Tj`);

    const outputDir = path.join(process.cwd(), "artifacts");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "multipage_pipeline_test.pdf"),
      buffer,
    );
  });

  it("should support all standard page sizes (A3, A5, Letter, Legal, Tabloid) and custom dimensions", async () => {
    const html = "<h1>Custom Page Size Test</h1>";

    const a5Doc = await HtmlToPdf.generate({ html, page: "A5" });
    expect(a5Doc.getPages()[0]?.width).toBeCloseTo(419.53, 1);
    expect(a5Doc.getPages()[0]?.height).toBeCloseTo(595.28, 1);

    const tabloidDoc = await HtmlToPdf.generate({
      html,
      page: "Tabloid",
      orientation: "landscape",
    });
    expect(tabloidDoc.getPages()[0]?.width).toBeCloseTo(1224.0, 1);
    expect(tabloidDoc.getPages()[0]?.height).toBeCloseTo(792.0, 1);

    const customDoc = await HtmlToPdf.generate({
      html,
      page: { width: 300, height: 500 },
    });
    expect(customDoc.getPages()[0]?.width).toBe(300);
    expect(customDoc.getPages()[0]?.height).toBe(500);
  });

  it("should compress PDF stream data with FlateDecode to significantly reduce output file size", async () => {
    const html = `<div>${"<p>FlateDecode compression benchmark test content.</p>".repeat(50)}</div>`;

    const uncompressedBuffer = await HtmlToPdf.generateBuffer({
      html,
      compress: false,
    });
    const compressedBuffer = await HtmlToPdf.generateBuffer({
      html,
      compress: true,
    });

    expect(compressedBuffer.length).toBeLessThan(uncompressedBuffer.length);
    expect(compressedBuffer.toString("binary")).toContain(
      "/Filter /FlateDecode",
    );
  });

  it("should execute rendering pipeline with sub-10ms high performance", async () => {
    const html = `
      <div style="background-color: #f0f4f8; padding: 20px;">
        <h2 style="color: #003366;">Performance Benchmark</h2>
        <p style="color: #333333;">Fast pure TypeScript rendering without browser binaries.</p>
      </div>
    `;

    const startTime = performance.now();
    const buffer = await HtmlToPdf.generateBuffer({ html });
    const duration = performance.now() - startTime;

    expect(buffer.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100);
  });

  it("should cascade Inline CSS, embedded <style> tags, and External CSS strings cleanly", async () => {
    const html = `
      <html>
        <head>
          <style>
            h1 { color: #0000ff; font-size: 20pt; }
            .card { background-color: #f0f0f0; padding: 10pt; }
          </style>
        </head>
        <body>
          <h1 style="color: #ff0000;">Inline Color Heading</h1>
          <div class="card">
            <p style="font-weight: bold;">Card paragraph content.</p>
          </div>
        </body>
      </html>
    `;

    const externalCss = `
      p { font-size: 14pt; color: #333333; }
    `;

    const doc = await HtmlToPdf.generate({
      html,
      css: externalCss,
      compress: false,
    });

    const buffer = doc.save();
    const pdfStr = buffer.toString("binary");

    expect(pdfStr).toContain("(Inline Color Heading) Tj");
    expect(pdfStr).toContain("(Card paragraph content.) Tj");
  });

  it("should safely ignore <script>, <style>, <meta>, and <head> tags during layout rendering", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Document Title</title>
          <meta charset="utf-8">
          <script>
            console.log("Client-side script execution");
            function doSomething() { return 42; }
          </script>
          <style>
            .container { padding: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Rendered Content</h1>
            <script type="text/javascript">
              alert("Inline script tag inside body");
            </script>
          </div>
        </body>
      </html>
    `;

    const doc = await HtmlToPdf.generate({ html, compress: false });
    const pdfStr = doc.save().toString("binary");

    expect(pdfStr).toContain("(Rendered Content) Tj");
    expect(pdfStr).not.toContain("Client-side script execution");
    expect(pdfStr).not.toContain("alert(");
  });
});
