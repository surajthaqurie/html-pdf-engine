import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 2 — Tax Invoice", () => {
  it("renders a formal tax invoice with VAT/GST breakdown and custom metadata", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 10pt; }
            .tax-header { border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 20px; }
            .tax-title { color: #0f766e; font-size: 20pt; margin: 0; text-transform: uppercase; }
            .grid-2 { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .details-box { width: 48%; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background-color: #f1f5f9; color: #334155; padding: 8px; text-align: left; font-size: 9pt; border-bottom: 2px solid #cbd5e1; }
            td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
            .right { text-align: right; }
            .summary { margin-top: 20px; width: 50%; margin-left: auto; }
            .summary td { padding: 5px; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="tax-header">
            <h1 class="tax-title">Tax Invoice / VAT Statement</h1>
            <div>GSTIN: 27AAAAA0000A1Z5 | VAT Reg #: UK99201948</div>
          </div>
          <div class="grid-2">
            <div class="details-box">
              <div class="bold">Supplier Details:</div>
              Nexus Digital Infrastructure Ltd<br/>
              77 High Street, London EC1A 1BB, UK<br/>
              VAT Reg: GB123456789
            </div>
            <div class="details-box">
              <div class="bold">Customer Tax Info:</div>
              Apex Logistics GmbH<br/>
              Industriestrasse 42, Munich, Germany<br/>
              EU VAT: DE987654321
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>HSN / SAC</th>
                <th>Item Description</th>
                <th class="right">Rate</th>
                <th class="right">Tax Rate</th>
                <th class="right">Taxable Amt</th>
                <th class="right">VAT Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>998313</td>
                <td>Cloud Compute Operations - EU Central</td>
                <td class="right">€4,000.00</td>
                <td class="right">19.0%</td>
                <td class="right">€4,000.00</td>
                <td class="right">€760.00</td>
              </tr>
              <tr>
                <td>998314</td>
                <td>Managed Database Cluster (High Availability)</td>
                <td class="right">€2,500.00</td>
                <td class="right">19.0%</td>
                <td class="right">€2,500.00</td>
                <td class="right">€475.00</td>
              </tr>
            </tbody>
          </table>
          <div class="summary">
            <table>
              <tr>
                <td>Total Taxable Value:</td>
                <td class="right bold">€6,500.00</td>
              </tr>
              <tr>
                <td>Total VAT / Tax:</td>
                <td class="right bold">€1,235.00</td>
              </tr>
              <tr style="font-size: 11pt; border-top: 2px solid #0f766e;">
                <td class="bold">Total Payable:</td>
                <td class="right bold">€7,735.00</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({
      html,
      meta: { title: "Tax Invoice - Nexus Digital", author: "Nexus Billing" },
    });

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBe(1);
  });
});
