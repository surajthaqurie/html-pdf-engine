import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 5 — Sales Order Confirmation", () => {
  it("renders a detailed sales order confirmation", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #334155; font-size: 10pt; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #ea580c; padding-bottom: 10px; }
            .brand { color: #ea580c; font-size: 20pt; font-weight: bold; }
            .info-row { display: flex; justify-content: space-between; margin: 15px 0; }
            .card { width: 48%; border: 1px solid #e2e8f0; padding: 12px; background: #fff7ed; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #ea580c; color: white; padding: 8px; text-align: left; font-size: 9pt; }
            td { padding: 8px; border-bottom: 1px solid #fed7aa; font-size: 9pt; }
            .right { text-align: right; }
            .grand-total { font-size: 12pt; font-weight: bold; color: #c2410c; margin-top: 15px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">SALES ORDER CONFIRMATION</div>
            <div style="text-align: right;">
              <strong>Order #:</strong> SO-9901-2026<br/>
              <strong>Date:</strong> August 15, 2026
            </div>
          </div>
          <div class="info-row">
            <div class="card">
              <strong>Customer:</strong><br/>
              Velocity Gaming Systems<br/>
              404 Cyber Way, Austin, TX 78701
            </div>
            <div class="card">
              <strong>Shipping Method:</strong><br/>
              FedEx Express Saver (2-Day Guaranteed)<br/>
              Estimated Delivery: Aug 18, 2026
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Specification</th>
                <th class="right">Qty</th>
                <th class="right">Unit Price</th>
                <th class="right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>GPU-V100</td>
                <td>Next-Gen Graphics Card 24GB GDDR6X</td>
                <td class="right">5</td>
                <td class="right">$1,499.00</td>
                <td class="right">$7,495.00</td>
              </tr>
              <tr>
                <td>CPU-I9</td>
                <td>24-Core Desktop Processor 5.8GHz</td>
                <td class="right">5</td>
                <td class="right">$589.00</td>
                <td class="right">$2,945.00</td>
              </tr>
            </tbody>
          </table>
          <div class="grand-total">Total Confirmed Order Value: $10,440.00</div>
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
