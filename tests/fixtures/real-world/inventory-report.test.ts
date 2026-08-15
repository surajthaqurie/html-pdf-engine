import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 8 — Inventory Stock Report", () => {
  it("renders a warehouse inventory report with stock status and category groupings", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 9pt; }
            h1 { color: #047857; margin-bottom: 2px; }
            .sub { color: #64748b; margin-bottom: 15px; }
            .category { background: #d1fae5; padding: 5px 10px; font-weight: bold; color: #065f46; margin-top: 15px; border-left: 4px solid #047857; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th { background: #f1f5f9; padding: 6px; text-align: left; font-size: 8pt; border-bottom: 1px solid #cbd5e1; }
            td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
            .badge-low { background: #fef2f2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
            .badge-ok { background: #f0fdf4; color: #166534; padding: 2px 6px; border-radius: 4px; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>Warehouse Inventory Valuation</h1>
          <div class="sub">Facility: Central Distribution Center #4 | Date: August 15, 2026</div>

          <div class="category">Category: Computer Accessories & Peripherals</div>
          <table>
            <thead>
              <tr><th>SKU</th><th>Item Name</th><th>Location</th><th class="right">In Stock</th><th class="right">Reorder Pt</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>PER-001</td><td>Ergonomic Mechanical Keyboard</td><td>Aisle 4-B</td><td class="right">120</td><td class="right">25</td><td><span class="badge-ok">In Stock</span></td></tr>
              <tr><td>PER-002</td><td>Precision Wireless Mouse</td><td>Aisle 4-C</td><td class="right">8</td><td class="right">15</td><td><span class="badge-low">LOW STOCK</span></td></tr>
            </tbody>
          </table>

          <div class="category">Category: Network Cabling & Racks</div>
          <table>
            <thead>
              <tr><th>SKU</th><th>Item Name</th><th>Location</th><th class="right">In Stock</th><th class="right">Reorder Pt</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>NET-101</td><td>Cat7 Shielded Cable 1000ft Spool</td><td>Aisle 12-A</td><td class="right">45</td><td class="right">10</td><td><span class="badge-ok">In Stock</span></td></tr>
              <tr><td>NET-102</td><td>Wall-Mount 9U Server Enclosure</td><td>Aisle 12-D</td><td class="right">3</td><td class="right">5</td><td><span class="badge-low">LOW STOCK</span></td></tr>
            </tbody>
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
