import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";

describe("Phase 5 — Multi-Page PDF Generation & Pagination Edge Cases", () => {
  it("should split content across multiple pages when vertical content overflows page height", async () => {
    const paragraphs = Array.from(
      { length: 50 },
      (_, i) => `<p style="height: 30pt; margin-bottom: 5pt;">Line Item Paragraph ${i + 1}</p>`,
    ).join("");

    const html = `<div>${paragraphs}</div>`;

    const doc = await HtmlToPdf.generate({
      html,
      page: "A4",
      compress: false,
    });

    const pages = doc.getPages();
    expect(pages.length).toBeGreaterThan(1);
  });

  it("should execute page-break-after: always cleanly", async () => {
    const html = `
      <div style="page-break-after: always;">Page 1 Content</div>
      <div>Page 2 Content</div>
    `;

    const doc = await HtmlToPdf.generate({ html, compress: false });
    const pages = doc.getPages();
    expect(pages.length).toBe(2);

    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Page 1 Content) Tj");
    expect(pdfStr).toContain("(Page 2 Content) Tj");
  });

  it("should format repeated headers and footers on every page of multi-page PDF", async () => {
    const paragraphs = Array.from(
      { length: 30 },
      (_, i) => `<p>Multi page paragraph content line #${i + 1}</p>`,
    ).join("");

    const doc = await HtmlToPdf.generate({
      html: `<div>${paragraphs}</div>`,
      header: { text: "Corporate Audit", align: "left", showDividerLine: true },
      footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "center" },
      compress: false,
    });

    const totalPages = doc.getPages().length;
    expect(totalPages).toBeGreaterThan(1);

    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Corporate Audit) Tj");
    expect(pdfStr).toContain(`(Page 1 of ${totalPages}) Tj`);
    expect(pdfStr).toContain(`(Page ${totalPages} of ${totalPages}) Tj`);
  });
});
