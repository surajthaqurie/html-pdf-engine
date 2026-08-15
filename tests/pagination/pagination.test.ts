import { describe, it, expect } from "vitest";
import { HeaderFooterRenderer } from "../../src/pdf/pdf-header-footer.js";
import { PDFPage } from "../../src/pdf/pdf-page.js";

describe("PDF Pagination, Headers & Footers", () => {
  it("should replace {{pageNumber}} and {{totalPages}} placeholders correctly", () => {
    const page = new PDFPage("A4", "portrait");
    const renderer = new HeaderFooterRenderer();

    renderer.renderHeaderAndFooter(page, 2, 5, {
      header: { text: "Internal Document", align: "left" },
      footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "center" },
    });

    const stream = page.contentStream.toString();
    expect(stream).toContain("(Internal Document)");
    expect(stream).toContain("(Page 2 of 5)");
  });
});
