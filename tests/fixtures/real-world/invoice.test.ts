import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";

describe("Real-World Fixture — Business Invoice", () => {
  it("renders a multi-line invoice fixture deterministically", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              --primary: #0284c7;
              --text-main: #1e293b;
              --bg-light: #f8fafc;
            }
            body { font-family: Helvetica, sans-serif; margin: 0; color: var(--text-main); }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 20px; }
            .title { color: var(--primary); font-size: 22pt; margin: 0; }
            .meta { font-size: 10pt; color: #64748b; text-align: right; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th { background-color: var(--bg-light); text-align: left; padding: 8px; font-size: 10pt; border-bottom: 1px solid #cbd5e1; }
            .table td { padding: 8px; font-size: 10pt; border-bottom: 1px solid #e2e8f0; }
            .total-box { margin-top: 20px; text-align: right; font-size: 12pt; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">INVOICE #INV-2026-991</h1>
            </div>
            <div class="meta">
              <strong>Date:</strong> August 15, 2026<br/>
              <strong>Due Date:</strong> September 15, 2026
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PDF Engine Consulting</td>
                <td>10 hrs</td>
                <td>$150.00</td>
                <td>$1,500.00</td>
              </tr>
              <tr>
                <td>Architecture Code Audit</td>
                <td>5 hrs</td>
                <td>$200.00</td>
                <td>$1,000.00</td>
              </tr>
            </tbody>
          </table>
          <div class="total-box">
            Amount Due: $2,500.00
          </div>
        </body>
      </html>
    `;

    const buf1 = await HtmlToPdf.generateBuffer({ html, compress: false });
    const buf2 = await HtmlToPdf.generateBuffer({ html, compress: false });

    // Byte-for-byte output determinism check
    expect(buf1.equals(buf2)).toBe(true);

    const doc = await HtmlToPdf.generate({ html });
    expect(doc.getPages().length).toBe(1);
  });
});
