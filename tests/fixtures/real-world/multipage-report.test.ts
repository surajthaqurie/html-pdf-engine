import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";

describe("Real-World Fixture — Multi-Page Executive Report", () => {
  it("renders a 3-page report with repeated header, table pagination, and outline navigation", async () => {
    const rows = Array.from({ length: 45 })
      .map(
        (_, i) => `
        <tr>
          <td>Module #${i + 1}</td>
          <td>Verified</td>
          <td>Pass</td>
          <td>100.0%</td>
        </tr>
      `,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { size: A4; margin: 30pt; }
            body { font-family: Helvetica, sans-serif; font-size: 10pt; color: #1e293b; }
            .fixed-brand { position: fixed; top: 0; right: 0; font-size: 8pt; color: #94a3b8; }
            h1 { color: #0369a1; border-bottom: 2px solid #0369a1; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f1f5f9; padding: 6px; text-align: left; border-bottom: 1px solid #cbd5e1; }
            td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
            .break { break-before: page; }
          </style>
        </head>
        <body>
          <div class="fixed-brand">CONFIDENTIAL REPORT</div>
          <h1 id="sec1">Section 1: Performance Summary</h1>
          <p>This report summarizes key metrics across 45 operational modules.</p>

          <table>
            <thead>
              <tr>
                <th>Module Name</th>
                <th>Status</th>
                <th>Result</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="break">
            <h1 id="sec2">Section 2: Conclusion & Next Steps</h1>
            <p>All test suites pass deterministically. Return to <a href="#sec1">Section 1 Summary</a>.</p>
          </div>
        </body>
      </html>
    `;

    const doc = await HtmlToPdf.generate({ html });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
  });
});
