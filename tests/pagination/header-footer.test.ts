import { describe, it, expect } from "vitest";
import { PDFDocument } from "../../src/pdf/pdf-document.js";

describe("Header and Footer Pagination Engine", () => {
  it("should render header and footer pagination across multiple pages", () => {
    const doc = new PDFDocument();
    doc.setCompress(false);

    doc.setHeader({
      text: "Confidential Report",
      align: "center",
      showDividerLine: true,
      fontSize: 10,
    });

    doc.setFooter({
      text: "Page {{pageNumber}} of {{totalPages}}",
      align: "right",
      showDividerLine: true,
      fontSize: 9,
    });

    // Add page 1
    const p1 = doc.addPage("A4", "portrait");
    p1.drawText("Page 1 Content", 50, 100);

    // Add page 2
    const p2 = doc.addPage("A4", "portrait");
    p2.drawText("Page 2 Content", 50, 100);

    const buffer = doc.save();
    const pdfStr = buffer.toString("binary");

    // Check header text
    expect(pdfStr).toContain("(Confidential Report) Tj");

    // Check pagination strings for both pages
    expect(pdfStr).toContain("(Page 1 of 2) Tj");
    expect(pdfStr).toContain("(Page 2 of 2) Tj");
  });

  it("should support dynamic header/footer text resolver functions", () => {
    const doc = new PDFDocument();
    doc.setCompress(false);

    doc.setFooter({
      text: (pageNo, total) => `Page ${pageNo} / ${total}`,
      align: "center",
    });

    doc.addPage();
    doc.addPage();

    const buffer = doc.save();
    const pdfStr = buffer.toString("binary");

    expect(pdfStr).toContain("(Page 1 / 2) Tj");
    expect(pdfStr).toContain("(Page 2 / 2) Tj");
  });
});
