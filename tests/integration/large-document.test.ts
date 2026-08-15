import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../utils/pdf-validator.js";

describe("Phase 23 — Large Document & Stress Testing", () => {
  it("renders a 100-row document deterministically with valid PDF structure", async () => {
    const rows = Array.from({ length: 100 })
      .map(
        (_, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td>Item Description Line for Item ${i + 1}</td>
          <td>Category ${i % 5}</td>
          <td>$${(10 + i * 1.5).toFixed(2)}</td>
        </tr>
      `,
      )
      .join("");

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; font-size: 9pt; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 4px; }
          </style>
        </head>
        <body>
          <h1>100 Row Data Table</h1>
          <table>
            <thead><tr><th>ID</th><th>Description</th><th>Category</th><th>Price</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    const buf1 = await HtmlToPdf.generateBuffer({ html, compress: false });
    const buf2 = await HtmlToPdf.generateBuffer({ html, compress: false });

    expect(buf1.equals(buf2)).toBe(true);

    const validation = validatePdfStructure(buf1);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBeGreaterThanOrEqual(2);
  });

  it("renders a 500-row large document without crashing or leaking memory", async () => {
    const rows = Array.from({ length: 500 })
      .map(
        (_, i) => `
        <tr>
          <td>ROW-${i + 1}</td>
          <td>Audit entry item ${i + 1}</td>
          <td>${(i * 12.34).toFixed(2)}</td>
        </tr>
      `,
      )
      .join("");

    const html = `<html><body><table><tbody>${rows}</tbody></table></body></html>`;

    const startMemory = process.memoryUsage().heapUsed;
    const buf = await HtmlToPdf.generateBuffer({ html, compress: true });
    const endMemory = process.memoryUsage().heapUsed;

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBeGreaterThanOrEqual(2);

    // Ensure memory delta per render is bounded
    const heapDeltaMb = (endMemory - startMemory) / (1024 * 1024);
    expect(heapDeltaMb).toBeLessThan(150);
  });

  it("renders a 1,000-row document efficiently", async () => {
    const rows = Array.from({ length: 1000 })
      .map(
        (_, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>Record entry for ledger transaction number ${i + 1}</td>
          <td>Status-OK</td>
        </tr>
      `,
      )
      .join("");

    const html = `<html><body><table><tbody>${rows}</tbody></table></body></html>`;

    const startTime = Date.now();
    const buf = await HtmlToPdf.generateBuffer({ html, compress: true });
    const duration = Date.now() - startTime;

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(buf.length).toBeGreaterThan(0);
    // 1000 rows should complete within 3 seconds
    expect(duration).toBeLessThan(3000);
  });

  it("renders a 5,000-row high-volume document safely", async () => {
    const rows = Array.from({ length: 5000 })
      .map(
        (_, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>Data item ${i + 1}</td>
        </tr>
      `,
      )
      .join("");

    const html = `<html><body><table><tbody>${rows}</tbody></table></body></html>`;

    const buf = await HtmlToPdf.generateBuffer({ html, compress: true });
    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBeGreaterThanOrEqual(2);
  });
});
