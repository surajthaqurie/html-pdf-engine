import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 9 — Product Catalog Table", () => {
  it("renders a multi-column product specification table with images and flex tags", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 9.5pt; }
            h1 { color: #4338ca; text-align: center; margin-bottom: 5px; }
            .tagline { text-align: center; color: #64748b; margin-bottom: 20px; font-size: 9pt; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #4338ca; color: white; padding: 8px; text-align: left; font-size: 9pt; }
            td { padding: 8px; border-bottom: 1px solid #e0e7ff; vertical-align: top; }
            .spec-list { margin: 0; padding-left: 15px; font-size: 8.5pt; color: #475569; }
            .price { font-weight: bold; color: #3730a3; font-size: 11pt; }
          </style>
        </head>
        <body>
          <h1>2026 Developer Hardware Catalog</h1>
          <div class="tagline">High-Performance Workstations & Server Equipment</div>
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Specifications</th>
                <th>Warranty</th>
                <th>MSRP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Titan Workstation Ultra</strong></td>
                <td>
                  <ul class="spec-list">
                    <li>CPU: AMD Threadripper PRO 7995WX (96 Cores)</li>
                    <li>RAM: 512GB ECC DDR5-5600</li>
                    <li>GPU: 2x NVIDIA RTX 6000 Ada 48GB</li>
                  </ul>
                </td>
                <td>3-Yr Onsite SLA</td>
                <td><span class="price">$14,999.00</span></td>
              </tr>
              <tr>
                <td><strong>Apex Server Blade 1U</strong></td>
                <td>
                  <ul class="spec-list">
                    <li>CPU: Dual Intel Xeon Platinum 8592+</li>
                    <li>Storage: 8x 7.68TB NVMe PCIe 5.0 SSD</li>
                    <li>Networking: Quad 100GbE SFP28</li>
                  </ul>
                </td>
                <td>5-Yr Enterprise 24/7</td>
                <td><span class="price">$18,499.00</span></td>
              </tr>
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
