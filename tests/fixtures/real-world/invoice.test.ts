import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 1 — Commercial Invoice", () => {
  it("renders a commercial invoice deterministically with valid PDF structure", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              --primary: #0284c7;
              --text-main: #1e293b;
              --bg-light: #f8fafc;
              --border: #e2e8f0;
            }
            body { font-family: Helvetica, sans-serif; margin: 0; color: var(--text-main); font-size: 10pt; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 20px; }
            .title { color: var(--primary); font-size: 22pt; margin: 0; }
            .company { font-weight: bold; font-size: 12pt; }
            .meta { text-align: right; color: #64748b; }
            .addresses { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .box { width: 48%; border: 1px solid var(--border); padding: 10px; background-color: var(--bg-light); }
            .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .table th { background-color: var(--primary); color: white; text-align: left; padding: 8px; font-size: 9pt; }
            .table td { padding: 8px; border-bottom: 1px solid var(--border); }
            .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
            .totals-table { width: 40%; border-collapse: collapse; }
            .totals-table td { padding: 6px; }
            .grand-total { font-weight: bold; border-top: 2px solid var(--primary); font-size: 11pt; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">COMMERCIAL INVOICE</h1>
              <div class="company">Acme Enterprise Technologies Inc.</div>
            </div>
            <div class="meta">
              <strong>Invoice #:</strong> INV-2026-8801<br/>
              <strong>Date:</strong> 2026-08-15<br/>
              <strong>Due Date:</strong> 2026-09-15
            </div>
          </div>

          <div class="addresses">
            <div class="box">
              <strong>Billed To:</strong><br/>
              Global Solutions Corp<br/>
              100 Technology Plaza, Suite 400<br/>
              San Francisco, CA 94105
            </div>
            <div class="box">
              <strong>Pay To:</strong><br/>
              Acme Enterprise Technologies<br/>
              Accounts Receivable<br/>
              P.O. Box 77291, Austin, TX
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Item #</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>SKU-101</td>
                <td>Enterprise Software License - Annual</td>
                <td>2</td>
                <td>$2,500.00</td>
                <td>$5,000.00</td>
              </tr>
              <tr>
                <td>SKU-204</td>
                <td>Cloud PDF Rendering Engine Implementation</td>
                <td>40 hrs</td>
                <td>$175.00</td>
                <td>$7,000.00</td>
              </tr>
              <tr>
                <td>SKU-502</td>
                <td>24/7 SLA Support Package</td>
                <td>1</td>
                <td>$1,200.00</td>
                <td>$1,200.00</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">$13,200.00</td>
              </tr>
              <tr>
                <td>Tax (8.5%):</td>
                <td style="text-align: right;">$1,122.00</td>
              </tr>
              <tr class="grand-total">
                <td>Total Due:</td>
                <td style="text-align: right;">$14,322.00</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;

    const buf1 = await HtmlToPdf.generateBuffer({ html, compress: false });
    const buf2 = await HtmlToPdf.generateBuffer({ html, compress: false });

    expect(buf1.equals(buf2)).toBe(true);

    const validation = validatePdfStructure(buf1);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBe(1);
  });
});
