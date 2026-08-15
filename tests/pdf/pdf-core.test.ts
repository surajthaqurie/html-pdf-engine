import { describe, it, expect } from "vitest";
import { PDFDocument } from "../../src/pdf/pdf-document.js";
import { PDFStream } from "../../src/pdf/pdf-stream.js";
import { XRefTable } from "../../src/pdf/xref.js";
import { PDFTrailer } from "../../src/pdf/trailer.js";
import { PDFRef } from "../../src/pdf/pdf-object.js";

describe("PDF Core Binary Serializer Engine", () => {
  it("should construct valid PDF header, catalog, pages, xref, and trailer syntax", () => {
    const doc = new PDFDocument();
    doc.setCompress(false);
    doc.addPage("A4", "portrait");

    const page = doc.getPages()[0];
    expect(page).toBeDefined();
    page?.drawText("Hello PDF Engine", 50, 100);

    const buffer = doc.save();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const pdfStr = buffer.toString("binary");

    expect(pdfStr).toContain("%PDF-1.7");
    expect(pdfStr).toContain("/Type /Catalog");
    expect(pdfStr).toContain("/Type /Pages");
    expect(pdfStr).toContain("/Type /Page");
    expect(pdfStr).toContain("xref");
    expect(pdfStr).toContain("trailer");
    expect(pdfStr).toContain("startxref");
    expect(pdfStr).toContain("%%EOF");
  });

  it("should calculate correct byte offsets in xref table", () => {
    const xref = new XRefTable();
    xref.addEntry(1, 15);
    xref.addEntry(2, 120);

    const bytes = xref.toBytes();
    const str = new TextDecoder().decode(bytes);

    expect(str).toContain("0000000015 00000 n");
    expect(str).toContain("0000000120 00000 n");
  });

  it("should compress stream data with zlib FlateDecode", () => {
    const rawData = new TextEncoder().encode("Hello World ".repeat(100));
    const uncompressedStream = new PDFStream(rawData, undefined, false);
    const compressedStream = new PDFStream(rawData, undefined, true);

    expect(compressedStream.toBytes().length).toBeLessThan(
      uncompressedStream.toBytes().length,
    );
  });
});
