import { describe, it, expect } from "vitest";
import { PDFDocument } from "../../src/pdf/pdf-document.js";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";

describe("Phase 6 — PDF Document Structure & Conformance Verification", () => {
  it("should output valid PDF 1.7 structural catalog, pages, font, and trailer", () => {
    const doc = new PDFDocument();
    doc.setCompress(false);
    const page = doc.addPage("A4");
    doc.addFont("Helvetica");
    page.drawText("A", 10, 10, { fontName: "Helvetica" });

    const buffer = doc.save();
    const pdfStr = buffer.toString("binary");

    // PDF Magic Bytes Header
    expect(pdfStr.startsWith("%PDF-1.7")).toBe(true);

    // Structural Dictionary Objects
    expect(pdfStr).toContain("/Type /Catalog");
    expect(pdfStr).toContain("/Type /Pages");
    expect(pdfStr).toContain("/Type /Page");
    expect(pdfStr).toContain("/Type /Font");

    // XRef Table and Trailer
    expect(pdfStr).toContain("xref");
    expect(pdfStr).toContain("trailer");
    expect(pdfStr).toContain("startxref");
    expect(pdfStr.endsWith("%%EOF\n") || pdfStr.endsWith("%%EOF")).toBe(true);
  });

  it("should output PDF Metadata Info dictionary when metadata options are configured", async () => {
    const doc = await HtmlToPdf.generate({
      html: "<h1>Document Metadata Test</h1>",
      compress: false,
      metadata: {
        title: "Quarterly Financial Report",
        author: "Acme Finance Corp",
        subject: "Q3 Earnings",
        keywords: "finance, report, pdf",
        creator: "html-pdf-engine v1.0",
      },
    });

    const buffer = doc.save();
    const pdfStr = buffer.toString("binary");

    expect(pdfStr).toContain("(Quarterly Financial Report)");
    expect(pdfStr).toContain("(Acme Finance Corp)");
    expect(pdfStr).toContain("(Q3 Earnings)");
    expect(pdfStr).toContain("/Info ");
  });

  it("should compress stream contents using zlib FlateDecode when compress: true", async () => {
    const html = `<div>${"<p>Testing PDF FlateDecode compression output size.</p>".repeat(40)}</div>`;

    const uncompressedDoc = await HtmlToPdf.generate({ html, compress: false });
    const compressedDoc = await HtmlToPdf.generate({ html, compress: true });

    const uncompressedBuffer = uncompressedDoc.save();
    const compressedBuffer = compressedDoc.save();

    expect(compressedBuffer.length).toBeLessThan(uncompressedBuffer.length);
    expect(compressedBuffer.toString("binary")).toContain("/Filter /FlateDecode");
  });
});
