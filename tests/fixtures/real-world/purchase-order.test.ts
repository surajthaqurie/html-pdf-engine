import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 4 — Purchase Order", () => {
  it("renders a formal corporate purchase order", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 10pt; }
            .po-title { color: #1e40af; font-size: 22pt; margin: 0; border-bottom: 3px solid #1e40af; padding-bottom: 8px; }
            .info-grid { display: flex; justify-content: space-between; margin: 20px 0; }
            .box { width: 31%; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc; }
            .box h3 { margin: 0 0 5px 0; font-size: 10pt; color: #1e40af; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #1e40af; color: white; padding: 8px; text-align: left; font-size: 9pt; }
            td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
            .total-row { font-weight: bold; background-color: #eff6ff; }
            .terms { margin-top: 25px; padding: 10px; border: 1px solid #e2e8f0; font-size: 8pt; color: #475569; }
          </style>
        </head>
        <body>
          <h1 class="po-title">PURCHASE ORDER #PO-2026-0042</h1>
          
          <div class="info-grid">
            <div class="box">
              <h3>Vendor:</h3>
              Starlight Electronics Ltd<br/>
              45 Industrial Parkway<br/>
              Chicago, IL 60607
            </div>
            <div class="box">
              <h3>Ship To:</h3>
              Acme Operations Center<br/>
              88 Warehouse Row, Dock B<br/>
              Dallas, TX 75201
            </div>
            <div class="box">
              <h3>PO Details:</h3>
              <strong>Date:</strong> 2026-08-15<br/>
              <strong>Buyer:</strong> Sarah Connor<br/>
              <strong>Payment Terms:</strong> Net 30
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Part #</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Cost</th>
                <th>Extended Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>MOD-882</td>
                <td>High-Density Fiber Transceiver 100G</td>
                <td>50</td>
                <td>$220.00</td>
                <td>$11,000.00</td>
              </tr>
              <tr>
                <td>CAB-109</td>
                <td>Cat6a Shielded Patch Cable 10m</td>
                <td>200</td>
                <td>$12.50</td>
                <td>$2,500.00</td>
              </tr>
              <tr>
                <td>RCK-401</td>
                <td>42U Server Rack Cabinet Heavy Duty</td>
                <td>4</td>
                <td>$1,100.00</td>
                <td>$4,400.00</td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align: right;">Total Purchase Order Value:</td>
                <td>$17,900.00</td>
              </tr>
            </tbody>
          </table>

          <div class="terms">
            <strong>Standard Terms & Conditions:</strong><br/>
            1. All goods must be delivered within 14 business days of PO issuance.<br/>
            2. Packing slips must reference PO #PO-2026-0042.<br/>
            3. Damaged goods must be reported within 48 hours of delivery.
          </div>
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
