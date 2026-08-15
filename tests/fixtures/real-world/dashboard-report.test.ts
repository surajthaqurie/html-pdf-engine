import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 12 — Analytics Dashboard Report", () => {
  it("renders a multi-column analytics dashboard with grid KPI cards and data tables", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 9.5pt; }
            .header { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: white; padding: 12px 15px; margin-bottom: 20px; border-radius: 4px; }
            .header h1 { margin: 0; font-size: 16pt; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; }
            .kpi-title { font-size: 8pt; color: #64748b; font-weight: bold; text-transform: uppercase; }
            .kpi-value { font-size: 16pt; font-weight: bold; color: #0284c7; margin: 4px 0; }
            .kpi-trend { font-size: 8pt; color: #16a34a; }
            .section-title { font-size: 12pt; color: #0f172a; margin: 15px 0 8px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-size: 8.5pt; color: #475569; }
            td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Platform Performance Dashboard</h1>
            <div>August 2026 Monthly Overview</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">Total Renders</div>
              <div class="kpi-value">1.42M</div>
              <div class="kpi-trend">+14.2% YoY</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Avg Latency</div>
              <div class="kpi-value">3.2 ms</div>
              <div class="kpi-trend">-18.5% improvement</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Uptime SLA</div>
              <div class="kpi-value">99.99%</div>
              <div class="kpi-trend">0 outages</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Memory Footprint</div>
              <div class="kpi-value">18.4 MB</div>
              <div class="kpi-trend">Stable</div>
            </div>
          </div>

          <div class="section-title">Regional Traffic Breakdown</div>
          <table>
            <thead>
              <tr><th>Region</th><th>Requests</th><th>Errors</th><th>P95 Latency</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>us-east-1 (N. Virginia)</td><td>620,000</td><td>0.00%</td><td>4.1 ms</td><td>Healthy</td></tr>
              <tr><td>eu-west-1 (Ireland)</td><td>480,000</td><td>0.01%</td><td>4.8 ms</td><td>Healthy</td></tr>
              <tr><td>ap-southeast-1 (Singapore)</td><td>320,000</td><td>0.00%</td><td>5.2 ms</td><td>Healthy</td></tr>
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
