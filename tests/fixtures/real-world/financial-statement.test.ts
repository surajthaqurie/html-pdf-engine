import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 6 — Financial Statement", () => {
  it("renders a multi-section corporate balance sheet & profit/loss statement", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #0f172a; font-size: 10pt; }
            .title { text-align: center; color: #0284c7; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #64748b; margin-bottom: 20px; font-size: 9pt; }
            .section-header { background: #0284c7; color: white; padding: 6px 10px; font-weight: bold; margin-top: 15px; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
            .right { text-align: right; }
            .indent { padding-left: 25px; }
            .total-row { font-weight: bold; background: #f0f9ff; border-top: 2px solid #0284c7; border-bottom: 2px solid #0284c7; }
          </style>
        </head>
        <body>
          <h1 class="title">GLOBAL HOLDINGS CORP</h1>
          <div class="subtitle">CONSOLIDATED STATEMENT OF FINANCIAL POSITION<br/>As of June 30, 2026 (Audited, in USD thousands)</div>

          <div class="section-header">ASSETS</div>
          <table>
            <tr><td class="bold">Current Assets</td><td class="right bold">2026</td><td class="right bold">2025</td></tr>
            <tr><td class="indent">Cash and cash equivalents</td><td class="right">$42,500</td><td class="right">$38,200</td></tr>
            <tr><td class="indent">Trade receivables, net</td><td class="right">$18,400</td><td class="right">$15,100</td></tr>
            <tr><td class="indent">Inventories</td><td class="right">$12,900</td><td class="right">$11,400</td></tr>
            <tr class="total-row"><td>Total Current Assets</td><td class="right">$73,800</td><td class="right">$64,700</td></tr>
          </table>

          <div class="section-header">EQUITY AND LIABILITIES</div>
          <table>
            <tr><td class="bold">Current Liabilities</td><td class="right bold">2026</td><td class="right bold">2025</td></tr>
            <tr><td class="indent">Trade payables</td><td class="right">$14,200</td><td class="right">$12,800</td></tr>
            <tr><td class="indent">Short-term borrowings</td><td class="right">$8,500</td><td class="right">$7,000</td></tr>
            <tr class="total-row"><td>Total Current Liabilities</td><td class="right">$22,700</td><td class="right">$19,800</td></tr>
          </table>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html });
    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBe(1);
  });
});
