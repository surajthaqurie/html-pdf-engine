import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 3 — Payment Receipt", () => {
  it("renders a compact payment receipt deterministically", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; padding: 20px; color: #0f172a; font-size: 9pt; }
            .receipt-card { border: 1px dashed #94a3b8; padding: 15px; border-radius: 6px; background-color: #f8fafc; }
            .center { text-align: center; }
            .badge { display: inline-block; background-color: #22c55e; color: white; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 8pt; }
            .divider { border-bottom: 1px dashed #cbd5e1; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .amount { font-size: 16pt; font-weight: bold; color: #166534; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="center">
              <h2 style="margin: 0; font-size: 14pt;">PAYMENT RECEIPT</h2>
              <div style="color: #64748b; margin-top: 2px;">Merchant: TechStore Online Ltd</div>
              <div class="amount">$499.00</div>
              <span class="badge">PAID IN FULL</span>
            </div>
            <div class="divider"></div>
            <div class="row"><span>Transaction ID:</span><strong>TXN-88391204</strong></div>
            <div class="row"><span>Date & Time:</span><span>2026-08-15 14:22:05 UTC</span></div>
            <div class="row"><span>Payment Method:</span><span>Visa ending in **** 4242</span></div>
            <div class="row"><span>Authorization Code:</span><span>AUTH-99102</span></div>
            <div class="divider"></div>
            <div class="row"><span>Product:</span><span>Developer Studio Workstation Pro</span></div>
            <div class="row"><span>Subtotal:</span><span>$457.80</span></div>
            <div class="row"><span>Tax (9%):</span><span>$41.20</span></div>
            <div class="divider"></div>
            <div class="center" style="color: #64748b; font-size: 8pt;">
              Thank you for your business! For support visit support.techstore.com
            </div>
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
