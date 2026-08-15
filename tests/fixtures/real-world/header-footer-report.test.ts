import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 14 — Document with Dynamic Headers & Footers", () => {
  it("renders a multi-page document with configured page headers and page number footers", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; font-size: 10pt; color: #1e293b; }
            h1 { color: #0284c7; }
            .page-break { break-before: page; }
          </style>
        </head>
        <body>
          <h1>Page 1: Policy Overview</h1>
          <p>This document details corporate governance and compliance policies.</p>
          
          <div class="page-break">
            <h1>Page 2: Security Guidelines</h1>
            <p>All system components operate in strict isolation without external dependencies.</p>
          </div>

          <div class="page-break">
            <h1>Page 3: Appendices</h1>
            <p>End of report document.</p>
          </div>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({
      html,
      header: {
        text: "ACME CORP COMPLIANCE POLICY",
        align: "right",
        showDividerLine: true,
      },
      footer: {
        text: "Page {{pageNumber}} of {{totalPages}}",
        align: "center",
        showDividerLine: true,
      },
    });

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBe(3);
  });
});
