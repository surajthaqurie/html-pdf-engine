import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 13 — Long Table Report (150 Rows)", () => {
  it("renders a 150-row data table spanning multiple pages cleanly without overlap", async () => {
    const rows = Array.from({ length: 150 })
      .map(
        (_, i) => `
        <tr>
          <td>ROW-${(i + 1).toString().padStart(4, "0")}</td>
          <td>Transaction Log Entry #${i + 1}</td>
          <td>${((i + 1) * 17.5).toFixed(2)} USD</td>
          <td>${i % 2 === 0 ? "Completed" : "Pending"}</td>
        </tr>
      `,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 9pt; }
            h1 { color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #334155; color: white; padding: 6px; text-align: left; font-size: 8.5pt; }
            td { padding: 5px 6px; border-bottom: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <h1>High-Volume Transaction Ledger</h1>
          <p>Complete audit record of 150 transactions executed on August 15, 2026.</p>
          <table>
            <thead>
              <tr><th>Ref ID</th><th>Description</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html });
    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBeGreaterThanOrEqual(2);
  });
});
